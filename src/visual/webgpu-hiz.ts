export interface WebGpuHiZRuntime {
  readonly levels: number;
  readonly width: number;
  readonly height: number;
  update(sourceDepth: any): void;
  readLastMinimum(): Promise<number>;
  readBaseCenter(): Promise<number>;
  dispose(): void;
}

export function createWebGpuHiZRuntime(device: any, width: number, height: number): WebGpuHiZRuntime {
  const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
  const usage = (globalThis as any).GPUTextureUsage;
  const texture = device.createTexture({
    size: [width, height],
    mipLevelCount: levels,
    format: "r32float",
    usage: usage.STORAGE_BINDING | usage.TEXTURE_BINDING | usage.COPY_SRC,
  });
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var sourceDepth: texture_depth_multisampled_2d;
    @group(0) @binding(1) var destinationDepth: texture_storage_2d<r32float, write>;
    @compute @workgroup_size(8, 8)
    fn copyDepth(@builtin(global_invocation_id) id: vec3<u32>) {
      let size = textureDimensions(destinationDepth);
      if (id.x >= size.x || id.y >= size.y) { return; }
      let coordinate = vec2<i32>(id.xy);
      let d0 = textureLoad(sourceDepth, coordinate, 0);
      let d1 = textureLoad(sourceDepth, coordinate, 1);
      let d2 = textureLoad(sourceDepth, coordinate, 2);
      let d3 = textureLoad(sourceDepth, coordinate, 3);
      textureStore(destinationDepth, coordinate, vec4<f32>(min(min(d0, d1), min(d2, d3)), 0.0, 0.0, 1.0));
    }
    @group(1) @binding(0) var sourceMin: texture_2d<f32>;
    @group(1) @binding(1) var destinationMin: texture_storage_2d<r32float, write>;
    @compute @workgroup_size(8, 8)
    fn reduceMin(@builtin(global_invocation_id) id: vec3<u32>) {
      let destinationSize = textureDimensions(destinationMin);
      if (id.x >= destinationSize.x || id.y >= destinationSize.y) { return; }
      let sourceSize = textureDimensions(sourceMin);
      let base = vec2<i32>(id.xy * 2u);
      let maximum = vec2<i32>(sourceSize) - vec2<i32>(1);
      let d0 = textureLoad(sourceMin, min(base, maximum), 0).r;
      let d1 = textureLoad(sourceMin, min(base + vec2<i32>(1, 0), maximum), 0).r;
      let d2 = textureLoad(sourceMin, min(base + vec2<i32>(0, 1), maximum), 0).r;
      let d3 = textureLoad(sourceMin, min(base + vec2<i32>(1, 1), maximum), 0).r;
      textureStore(destinationMin, vec2<i32>(id.xy), vec4<f32>(min(min(d0, d1), min(d2, d3)), 0.0, 0.0, 1.0));
    }`,
  });
  const copyPipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "copyDepth" } });
  const reducePipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "reduceMin" } });

  return {
    levels,
    width,
    height,
    update(sourceDepth) {
      const encoder = device.createCommandEncoder();
      let pass = encoder.beginComputePass();
      const mip0 = texture.createView({ baseMipLevel: 0, mipLevelCount: 1 });
      const copyGroup = device.createBindGroup({ layout: copyPipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: sourceDepth.createView() },
        { binding: 1, resource: mip0 },
      ] });
      pass.setPipeline(copyPipeline);
      pass.setBindGroup(0, copyGroup);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
      for (let level = 1; level < levels; level++) {
        const mipWidth = Math.max(1, width >> level);
        const mipHeight = Math.max(1, height >> level);
        const sourceView = texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 });
        const destinationView = texture.createView({ baseMipLevel: level, mipLevelCount: 1 });
        const group = device.createBindGroup({ layout: reducePipeline.getBindGroupLayout(1), entries: [
          { binding: 0, resource: sourceView },
          { binding: 1, resource: destinationView },
        ] });
        pass = encoder.beginComputePass();
        pass.setPipeline(reducePipeline);
        pass.setBindGroup(1, group);
        pass.dispatchWorkgroups(Math.ceil(mipWidth / 8), Math.ceil(mipHeight / 8));
        pass.end();
      }
      device.queue.submit([encoder.finish()]);
    },
    async readLastMinimum() {
      const bufferUsage = (globalThis as any).GPUBufferUsage;
      const mapMode = (globalThis as any).GPUMapMode;
      const buffer = device.createBuffer({ size: 256, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture, mipLevel: levels - 1 },
        { buffer, bytesPerRow: 256, rowsPerImage: 1 },
        [1, 1, 1],
      );
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(mapMode.READ);
      const value = new Float32Array(buffer.getMappedRange(), 0, 1)[0];
      buffer.unmap();
      buffer.destroy();
      return value;
    },
    async readBaseCenter() {
      const bufferUsage = (globalThis as any).GPUBufferUsage;
      const mapMode = (globalThis as any).GPUMapMode;
      const buffer = device.createBuffer({ size: 256, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture, mipLevel: 0, origin: [Math.floor(width / 2), Math.floor(height / 2), 0] },
        { buffer, bytesPerRow: 256, rowsPerImage: 1 },
        [1, 1, 1],
      );
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(mapMode.READ);
      const value = new Float32Array(buffer.getMappedRange(), 0, 1)[0];
      buffer.unmap();
      buffer.destroy();
      return value;
    },
    dispose() {
      texture.destroy();
    },
  };
}
