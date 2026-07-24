import * as THREE from "three";
import type { FroxelLightInput } from "./webgpu-ultra";

export interface WebGpuClusteredLighting {
  readonly texture: THREE.DataTexture;
  update(lights: readonly FroxelLightInput[]): Promise<boolean>;
  diagnostics(): { updates: number; lights: number; occupied: number };
  dispose(): void;
}

const CLUSTER_WIDTH = 32;
const CLUSTER_HEIGHT = 18;
const CLUSTER_DEPTH = 24;
const DEPTH_COLUMNS = 8;
const ATLAS_WIDTH = CLUSTER_WIDTH * DEPTH_COLUMNS;
const ATLAS_HEIGHT = CLUSTER_HEIGHT * (CLUSTER_DEPTH / DEPTH_COLUMNS);
const MAX_LIGHTS = 64;

export async function createWebGpuClusteredLighting(device: any): Promise<WebGpuClusteredLighting> {
  const textureUsage = (globalThis as any).GPUTextureUsage;
  const bufferUsage = (globalThis as any).GPUBufferUsage;
  const mapMode = (globalThis as any).GPUMapMode;
  const output = device.createTexture({
    size: [ATLAS_WIDTH, ATLAS_HEIGHT],
    format: "rgba8unorm",
    usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
  });
  const lightBuffer = device.createBuffer({ size: MAX_LIGHTS * 32, usage: bufferUsage.STORAGE | bufferUsage.COPY_DST });
  const params = device.createBuffer({ size: 16, usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST });
  const module = device.createShaderModule({ code: `
    struct Params { count: u32, width: u32, height: u32, depth: u32 };
    @group(0) @binding(0) var clusterAtlas: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(1) var<storage, read> lights: array<vec4<f32>, ${MAX_LIGHTS * 2}>;
    @group(0) @binding(2) var<uniform> params: Params;
    @compute @workgroup_size(8, 3, 1)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x >= params.width || id.y >= params.height || id.z >= params.depth) { return; }
      let center = vec3<f32>((vec2<f32>(id.xy) + 0.5) / vec2<f32>(f32(params.width), f32(params.height)), (f32(id.z) + 0.5) / f32(params.depth));
      var radiance = vec3<f32>(0.0);
      var energy = 0.0;
      for (var index = 0u; index < ${MAX_LIGHTS}u; index++) {
        if (index >= params.count) { break; }
        let shape = lights[index * 2u];
        let emission = lights[index * 2u + 1u];
        let screenRadius = max(shape.w * 0.78, 0.01);
        let depthRadius = max(0.03, screenRadius * 1.55);
        let delta = vec3<f32>((center.xy - shape.xy) / screenRadius, (center.z - shape.z) / depthRadius);
        let influence = exp(-dot(delta, delta) * 1.55) * emission.w;
        radiance = radiance + emission.rgb * influence;
        energy = energy + influence;
      }
      let mapped = vec3<f32>(1.0) - exp(-radiance * 0.72);
      let tile = vec2<u32>(id.z % ${DEPTH_COLUMNS}u, id.z / ${DEPTH_COLUMNS}u);
      let atlasPosition = vec2<i32>(tile * vec2<u32>(${CLUSTER_WIDTH}u, ${CLUSTER_HEIGHT}u) + id.xy);
      textureStore(clusterAtlas, atlasPosition, vec4<f32>(mapped, clamp(energy * 0.24, 0.0, 1.0)));
    }` });
  const compilation = await module.getCompilationInfo();
  const shaderErrors = compilation.messages.filter((message: any) => message.type === "error");
  if (shaderErrors.length) throw new Error(shaderErrors.map((message: any) => `${message.lineNum}:${message.linePos} ${message.message}`).join(" | "));
  device.pushErrorScope("validation");
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const validationError = await device.popErrorScope();
  if (validationError) throw new Error(`Clustered lighting validation: ${validationError.message}`);
  const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: output.createView() },
    { binding: 1, resource: { buffer: lightBuffer } },
    { binding: 2, resource: { buffer: params } },
  ] });
  const pixels = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  const texture = new THREE.DataTexture(pixels, ATLAS_WIDTH, ATLAS_HEIGHT, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  let pending = false;
  let disposed = false;
  let updates = 0;
  let lightCount = 0;
  let occupied = 0;

  async function update(input: readonly FroxelLightInput[]) {
    if (pending || disposed) return false;
    pending = true;
    const selected = input.slice(0, MAX_LIGHTS);
    lightCount = selected.length;
    const packed = new Float32Array(MAX_LIGHTS * 8);
    selected.forEach((light, index) => packed.set([
      light.screenX, light.screenY, light.depth, light.radius,
      light.color.r, light.color.g, light.color.b, Math.min(2.5, light.intensity),
    ], index * 8));
    device.queue.writeBuffer(lightBuffer, 0, packed);
    device.queue.writeBuffer(params, 0, new Uint32Array([selected.length, CLUSTER_WIDTH, CLUSTER_HEIGHT, CLUSTER_DEPTH]));
    const bytesPerRow = ATLAS_WIDTH * 4;
    const readback = device.createBuffer({ size: bytesPerRow * ATLAS_HEIGHT, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(CLUSTER_WIDTH / 8), Math.ceil(CLUSTER_HEIGHT / 3), CLUSTER_DEPTH);
    pass.end();
    encoder.copyTextureToBuffer({ texture: output }, { buffer: readback, bytesPerRow, rowsPerImage: ATLAS_HEIGHT }, [ATLAS_WIDTH, ATLAS_HEIGHT]);
    device.queue.submit([encoder.finish()]);
    try {
      await readback.mapAsync(mapMode.READ);
      pixels.set(new Uint8Array(readback.getMappedRange()));
      occupied = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 1) occupied++;
      texture.needsUpdate = true;
      updates++;
      readback.unmap();
      return true;
    } finally {
      readback.destroy();
      pending = false;
    }
  }

  return {
    texture,
    update,
    diagnostics: () => ({ updates, lights: lightCount, occupied }),
    dispose() {
      disposed = true;
      output.destroy();
      lightBuffer.destroy();
      params.destroy();
      texture.dispose();
    },
  };
}
