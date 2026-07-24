import * as THREE from "three";

export interface WebGpuAtmosphereLuts {
  transmittance: THREE.DataTexture;
  singleScattering: THREE.DataTexture;
  multipleScattering: THREE.DataTexture;
  backend: "COMPUTE_BRUNETON_3_LUT";
  ranges: string;
}

const TRANSMITTANCE_WIDTH = 256;
const TRANSMITTANCE_HEIGHT = 64;
const SCATTERING_WIDTH = 128;
const SCATTERING_HEIGHT = 64;

function dataTexture(data: Uint8Array, width: number, height: number) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function channelRange(data: Uint8Array) {
  let minimum = 255, maximum = 0;
  for (let index = 0; index < data.length; index += 4) {
    minimum = Math.min(minimum, data[index], data[index + 1], data[index + 2]);
    maximum = Math.max(maximum, data[index], data[index + 1], data[index + 2]);
  }
  return `${minimum}-${maximum}`;
}

export async function createWebGpuAtmosphereLuts(device: any): Promise<WebGpuAtmosphereLuts> {
  const textureUsage = (globalThis as any).GPUTextureUsage;
  const bufferUsage = (globalThis as any).GPUBufferUsage;
  const mapMode = (globalThis as any).GPUMapMode;
  const usage = textureUsage.STORAGE_BINDING | textureUsage.TEXTURE_BINDING | textureUsage.COPY_SRC;
  const transmittanceGpu = device.createTexture({ size: [TRANSMITTANCE_WIDTH, TRANSMITTANCE_HEIGHT], format: "rgba8unorm", usage });
  const singleGpu = device.createTexture({ size: [SCATTERING_WIDTH, SCATTERING_HEIGHT], format: "rgba8unorm", usage });
  const multipleGpu = device.createTexture({ size: [SCATTERING_WIDTH, SCATTERING_HEIGHT], format: "rgba8unorm", usage });
  const module = device.createShaderModule({ code: `
    const PI = 3.14159265359;
    const GROUND_RADIUS = 6360.0;
    const ATMOSPHERE_RADIUS = 6460.0;
    const RAYLEIGH_HEIGHT = 8.0;
    const MIE_HEIGHT = 1.2;
    const BETA_R = vec3<f32>(0.005802, 0.013558, 0.033100);
    const BETA_M = vec3<f32>(0.003996, 0.003996, 0.003996);
    @group(0) @binding(0) var transmittanceLut: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(1) var singleLut: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(2) var multipleLut: texture_storage_2d<rgba8unorm, write>;

    fn atmosphereDistance(radius: f32, mu: f32) -> f32 {
      let discriminant = radius * radius * (mu * mu - 1.0) + ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
      return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
    }
    fn opticalDepth(radius: f32, mu: f32, scaleHeight: f32) -> f32 {
      let distance = atmosphereDistance(radius, mu);
      var depth = 0.0;
      for (var sample = 0; sample < 40; sample++) {
        let t = distance * (f32(sample) + 0.5) / 40.0;
        let sampleRadius = sqrt(radius * radius + t * t + 2.0 * radius * mu * t);
        depth += exp(-(sampleRadius - GROUND_RADIUS) / scaleHeight) * distance / 40.0;
      }
      return depth;
    }
    fn transmittance(radius: f32, mu: f32) -> vec3<f32> {
      return exp(-(BETA_R * opticalDepth(radius, mu, RAYLEIGH_HEIGHT) + BETA_M * opticalDepth(radius, mu, MIE_HEIGHT)));
    }
    fn rayleighPhase(mu: f32) -> f32 { return 3.0 * (1.0 + mu * mu) / (16.0 * PI); }
    fn miePhase(mu: f32) -> f32 {
      let g = 0.76;
      return 3.0 * (1.0 - g * g) * (1.0 + mu * mu) / (8.0 * PI * (2.0 + g * g) * pow(max(0.025, 1.0 + g * g - 2.0 * g * mu), 1.5));
    }
    @compute @workgroup_size(8, 8)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < ${TRANSMITTANCE_WIDTH}u && id.y < ${TRANSMITTANCE_HEIGHT}u) {
        let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(${TRANSMITTANCE_WIDTH}.0, ${TRANSMITTANCE_HEIGHT}.0);
        let radius = mix(GROUND_RADIUS + 0.02, ATMOSPHERE_RADIUS - 0.02, uv.y * uv.y);
        let mu = mix(-0.12, 1.0, uv.x);
        textureStore(transmittanceLut, vec2<i32>(id.xy), vec4<f32>(transmittance(radius, mu), 1.0));
      }
      if (id.x < ${SCATTERING_WIDTH}u && id.y < ${SCATTERING_HEIGHT}u) {
        let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(${SCATTERING_WIDTH}.0, ${SCATTERING_HEIGHT}.0);
        let viewMu = mix(-0.08, 1.0, uv.y);
        let sunMu = mix(-0.18, 1.0, uv.x);
        let radius = GROUND_RADIUS + 0.2;
        let distance = atmosphereDistance(radius, viewMu);
        var rayleigh = vec3<f32>(0.0);
        var mie = vec3<f32>(0.0);
        for (var sample = 0; sample < 48; sample++) {
          let t = distance * (f32(sample) + 0.5) / 48.0;
          let sampleRadius = sqrt(radius * radius + t * t + 2.0 * radius * viewMu * t);
          let localHeight = max(0.0, sampleRadius - GROUND_RADIUS);
          let localTransmittance = transmittance(radius, viewMu) / max(transmittance(sampleRadius, viewMu), vec3<f32>(0.002));
          let sunTransmittance = transmittance(sampleRadius, sunMu);
          let stepLength = distance / 48.0;
          rayleigh += localTransmittance * sunTransmittance * exp(-localHeight / RAYLEIGH_HEIGHT) * BETA_R * stepLength;
          mie += localTransmittance * sunTransmittance * exp(-localHeight / MIE_HEIGHT) * BETA_M * stepLength;
        }
        let cosine = clamp(viewMu * sunMu + sqrt(max(0.0, 1.0 - viewMu * viewMu)) * sqrt(max(0.0, 1.0 - sunMu * sunMu)), -1.0, 1.0);
        let single = rayleigh * rayleighPhase(cosine) * 8.0 + mie * miePhase(cosine) * 5.0;
        let horizonCoupling = exp(-abs(viewMu) * 5.0) * (0.35 + 0.65 * max(sunMu, 0.0));
        let multiple = (rayleigh * vec3<f32>(0.42, 0.52, 0.72) + mie * vec3<f32>(0.72, 0.64, 0.52)) * (0.32 + horizonCoupling * 0.9);
        textureStore(singleLut, vec2<i32>(id.xy), vec4<f32>(1.0 - exp(-single), 1.0));
        textureStore(multipleLut, vec2<i32>(id.xy), vec4<f32>(1.0 - exp(-multiple * 2.4), 1.0));
      }
    }` });
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message: any) => message.type === "error");
  if (errors.length) throw new Error(errors.map((message: any) => `${message.lineNum}:${message.linePos} ${message.message}`).join(" | "));
  device.pushErrorScope("validation");
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const validationError = await device.popErrorScope();
  if (validationError) throw new Error(`Atmosphere LUT validation: ${validationError.message}`);
  const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: transmittanceGpu.createView() },
    { binding: 1, resource: singleGpu.createView() },
    { binding: 2, resource: multipleGpu.createView() },
  ] });
  const readTexture = async (texture: any, width: number, height: number) => {
    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const buffer = device.createBuffer({ size: bytesPerRow * height, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
    return { buffer, bytesPerRow, width, height, texture };
  };
  const reads = await Promise.all([
    readTexture(transmittanceGpu, TRANSMITTANCE_WIDTH, TRANSMITTANCE_HEIGHT),
    readTexture(singleGpu, SCATTERING_WIDTH, SCATTERING_HEIGHT),
    readTexture(multipleGpu, SCATTERING_WIDTH, SCATTERING_HEIGHT),
  ]);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(TRANSMITTANCE_WIDTH / 8), Math.ceil(TRANSMITTANCE_HEIGHT / 8)); pass.end();
  for (const read of reads) encoder.copyTextureToBuffer({ texture: read.texture }, { buffer: read.buffer, bytesPerRow: read.bytesPerRow, rowsPerImage: read.height }, [read.width, read.height]);
  device.queue.submit([encoder.finish()]);
  const arrays: Uint8Array[] = [];
  for (const read of reads) {
    await read.buffer.mapAsync(mapMode.READ);
    const padded = new Uint8Array(read.buffer.getMappedRange());
    const compact = new Uint8Array(read.width * read.height * 4);
    for (let row = 0; row < read.height; row++) compact.set(padded.subarray(row * read.bytesPerRow, row * read.bytesPerRow + read.width * 4), row * read.width * 4);
    arrays.push(compact); read.buffer.unmap(); read.buffer.destroy();
  }
  transmittanceGpu.destroy(); singleGpu.destroy(); multipleGpu.destroy();
  return {
    transmittance: dataTexture(arrays[0], TRANSMITTANCE_WIDTH, TRANSMITTANCE_HEIGHT),
    singleScattering: dataTexture(arrays[1], SCATTERING_WIDTH, SCATTERING_HEIGHT),
    multipleScattering: dataTexture(arrays[2], SCATTERING_WIDTH, SCATTERING_HEIGHT),
    backend: "COMPUTE_BRUNETON_3_LUT",
    ranges: arrays.map(channelRange).join("/"),
  };
}
