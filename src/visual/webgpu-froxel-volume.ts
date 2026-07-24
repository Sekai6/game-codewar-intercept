import {
  HalfFloatType,
  LinearFilter,
  Matrix4,
  PerspectiveCamera,
  PointLight,
  RGBAFormat,
  Storage3DTexture,
  Vector3,
} from "three/webgpu";

export interface WebGpuFroxelVolume {
  readonly texture: Storage3DTexture;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly slices: number;
  update(camera: PerspectiveCamera, lights: readonly PointLight[], timeSeconds: number): void;
  readCenter(): Promise<Float32Array>;
  dispose(): void;
}

const MAX_LIGHTS = 24;
const PARAM_FLOATS = 48;
const LIGHT_FLOATS = 8;
const worldPosition = new Vector3();

export async function createWebGpuFroxelVolume(
  renderer: any,
  width = 120,
  height = 68,
  depth = 48,
): Promise<WebGpuFroxelVolume> {
  const device = renderer.backend.device;
  const volume = new Storage3DTexture(width, height, depth);
  volume.format = RGBAFormat;
  volume.type = HalfFloatType;
  volume.minFilter = LinearFilter;
  volume.magFilter = LinearFilter;
  await renderer.initTextureAsync(volume);
  const gpuTexture = renderer.backend.get(volume).texture;
  if (!gpuTexture || gpuTexture.dimension !== "3d" || gpuTexture.format !== "rgba16float") {
    throw new Error(`Froxel Storage3DTexture initialization failed: ${gpuTexture?.dimension}/${gpuTexture?.format}`);
  }

  const usage = (globalThis as any).GPUBufferUsage;
  const paramsBuffer = device.createBuffer({
    size: PARAM_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: usage.UNIFORM | usage.COPY_DST,
  });
  const lightsBuffer = device.createBuffer({
    size: MAX_LIGHTS * LIGHT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: usage.STORAGE | usage.COPY_DST,
  });
  const shaderModule = device.createShaderModule({ code: `
    struct Params {
      inverseProjection: mat4x4<f32>,
      cameraWorld: mat4x4<f32>,
      cameraPositionTime: vec4<f32>,
      clipSunXSunY: vec4<f32>,
      sunZLightCount: vec4<f32>,
    };
    struct Light {
      positionRange: vec4<f32>,
      colorIntensity: vec4<f32>,
    };
    @group(0) @binding(0) var volume: texture_storage_3d<rgba16float, write>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read> lights: array<Light>;

    fn hash31(p: vec3<f32>) -> f32 {
      var q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    fn hgPhase(cosTheta: f32, g: f32) -> f32 {
      let g2 = g * g;
      return (1.0 - g2) / max(0.001, 12.56637 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
    }

    @compute @workgroup_size(4, 4, 4)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x >= ${width}u || id.y >= ${height}u || id.z >= ${depth}u) { return; }

      let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(${width}.0, ${height}.0);
      let ndc = uv * 2.0 - 1.0;
      let farViewH = params.inverseProjection * vec4<f32>(ndc, 1.0, 1.0);
      let farView = farViewH.xyz / max(0.0001, farViewH.w);
      let rayView = normalize(farView);
      let rayWorld = normalize((params.cameraWorld * vec4<f32>(rayView, 0.0)).xyz);
      let nearPlane = params.clipSunXSunY.x;
      let farPlane = params.clipSunXSunY.y;
      let slice = (f32(id.z) + 0.5) / ${depth}.0;
      let viewDistance = nearPlane * pow(farPlane / nearPlane, slice);
      let cameraPosition = params.cameraPositionTime.xyz;
      let world = cameraPosition + rayWorld * viewDistance;

      let seaFog = exp(-max(world.y, 0.0) * 0.115) * (0.00018 + 0.00020 * smoothstep(55.0, 360.0, viewDistance));
      let marineLayer = exp(-abs(world.y - 3.0) * 0.32) * 0.00010;
      let cloudBase = smoothstep(22.0, 25.0, world.y) * (1.0 - smoothstep(36.0, 43.0, world.y));
      let windPosition = world * vec3<f32>(0.055, 0.11, 0.055) + vec3<f32>(params.cameraPositionTime.w * 0.012, 0.0, params.cameraPositionTime.w * 0.006);
      let cloudNoise = hash31(floor(windPosition)) * 0.52 + hash31(floor(windPosition * 2.07)) * 0.31 + hash31(floor(windPosition * 4.13)) * 0.17;
      let cloudDensity = cloudBase * smoothstep(0.48, 0.76, cloudNoise) * 0.00070;
      var density = seaFog + marineLayer + cloudDensity;

      let lightCount = min(u32(params.sunZLightCount.y), ${MAX_LIGHTS}u);
      for (var smokeIndex = 0u; smokeIndex < lightCount; smokeIndex++) {
        let smokeLight = lights[smokeIndex];
        let warmSource = smokeLight.colorIntensity.r > smokeLight.colorIntensity.b * 1.2;
        let smokeRadius = max(smokeLight.positionRange.w * 1.25, 0.001);
        let smokeDistance = distance(smokeLight.positionRange.xyz, world);
        let smokeFalloff = pow(max(0.0, 1.0 - smokeDistance / smokeRadius), 2.0);
        density += select(0.0, smokeFalloff * 0.00035 * smokeLight.colorIntensity.a, warmSource);
      }
      density = clamp(density, 0.0, 0.012);

      let sunDirection = normalize(vec3<f32>(params.clipSunXSunY.zw, params.sunZLightCount.x));
      let viewToCamera = -rayWorld;
      let sunPhase = hgPhase(dot(viewToCamera, sunDirection), 0.62);
      var inscattering = density * (vec3<f32>(0.11, 0.16, 0.22) + vec3<f32>(1.0, 0.63, 0.32) * sunPhase * 5.2);

      for (var lightIndex = 0u; lightIndex < lightCount; lightIndex++) {
        let light = lights[lightIndex];
        let offset = light.positionRange.xyz - world;
        let distanceToLight = length(offset);
        let range = max(light.positionRange.w * 1.65, 0.001);
        let attenuation = pow(max(0.0, 1.0 - distanceToLight / range), 2.0);
        let lightDirection = offset / max(distanceToLight, 0.001);
        let phase = hgPhase(dot(viewToCamera, lightDirection), 0.35);
        inscattering += density * light.colorIntensity.rgb * light.colorIntensity.a * attenuation * phase * 6.5;
      }

      textureStore(volume, vec3<i32>(id), vec4<f32>(inscattering, density));
    }`,
  });
  const compilationInfo = await shaderModule.getCompilationInfo();
  const compilationErrors = compilationInfo.messages.filter((message: any) => message.type === "error");
  if (compilationErrors.length) {
    throw new Error(compilationErrors.map((message: any) => `${message.lineNum}:${message.linePos} ${message.message}`).join(" | "));
  }
  const pipeline = await device.createComputePipelineAsync({
    layout: "auto",
    compute: { module: shaderModule, entryPoint: "main" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: gpuTexture.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
      { binding: 1, resource: { buffer: paramsBuffer } },
      { binding: 2, resource: { buffer: lightsBuffer } },
    ],
  });
  const params = new Float32Array(PARAM_FLOATS);
  const lightData = new Float32Array(MAX_LIGHTS * LIGHT_FLOATS);
  const inverseProjection = new Matrix4();

  return {
    texture: volume,
    width,
    height,
    depth,
    slices: depth,
    update(camera, lights, timeSeconds) {
      camera.updateMatrixWorld();
      inverseProjection.copy(camera.projectionMatrix).invert();
      params.set(inverseProjection.elements, 0);
      params.set(camera.matrixWorld.elements, 16);
      params.set([camera.position.x, camera.position.y, camera.position.z, timeSeconds], 32);
      const sunLength = Math.hypot(-20, 30, 18);
      params.set([camera.near, camera.far, -20 / sunLength, 30 / sunLength], 36);
      params.set([18 / sunLength, Math.min(lights.length, MAX_LIGHTS), 0, 0], 40);
      lightData.fill(0);
      lights.slice(0, MAX_LIGHTS).forEach((light, index) => {
        light.getWorldPosition(worldPosition);
        const offset = index * LIGHT_FLOATS;
        lightData.set([worldPosition.x, worldPosition.y, worldPosition.z, light.distance], offset);
        lightData.set([light.color.r, light.color.g, light.color.b, light.intensity], offset + 4);
      });
      device.queue.writeBuffer(paramsBuffer, 0, params);
      device.queue.writeBuffer(lightsBuffer, 0, lightData);
      const encoder = device.createCommandEncoder();
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(width / 4), Math.ceil(height / 4), Math.ceil(depth / 4));
      computePass.end();
      device.queue.submit([encoder.finish()]);
    },
    async readCenter() {
      const mapMode = (globalThis as any).GPUMapMode;
      const buffer = device.createBuffer({ size: 256, usage: usage.COPY_DST | usage.MAP_READ });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture: gpuTexture, origin: [Math.floor(width / 2), Math.floor(height / 2), Math.floor(depth / 2)] },
        { buffer, bytesPerRow: 256, rowsPerImage: 1 },
        [1, 1, 1],
      );
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(mapMode.READ);
      const half = new Uint16Array(buffer.getMappedRange(), 0, 4);
      const convert = (value: number) => {
        const sign = (value & 0x8000) ? -1 : 1;
        const exponent = (value >> 10) & 0x1f;
        const fraction = value & 0x3ff;
        if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
        if (exponent === 31) return fraction ? NaN : sign * Infinity;
        return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
      };
      const result = new Float32Array(Array.from(half, convert));
      buffer.unmap();
      buffer.destroy();
      return result;
    },
    dispose() {
      paramsBuffer.destroy();
      lightsBuffer.destroy();
      volume.dispose();
    },
  };
}
