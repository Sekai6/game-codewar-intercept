# Native WebGPU Renderer Migration

The production scene remains on the validated hybrid WebGL 2 + WebGPU compute path while native renderer parity is built behind `/webgpu-lab.html`.

The first gate proves, on one `WebGPURenderer` and one depth buffer:

- `MeshStandardNodeMaterial` PBR rendering;
- native Three.js tiled lighting with 24 simultaneous point lights;
- TSL compute updating a 32,768-entry `StorageBufferAttribute`;
- direct `PointsNodeMaterial` drawing from that storage attribute without CPU readback;
- normal depth occlusion between storage particles and opaque geometry.
- native TRAA with velocity MRT, camera jitter, history reprojection, 3x3 neighborhood clamping and luminance weighting;
- a TSL ocean material sampling the 16-frame 64x64 Tessendorf FFT displacement/Jacobian atlas, plus a ship-aligned Kelvin/bow-wave local displacement and foam field;
- a TSL afternoon sky sampling the transmittance, single-scattering and multiple-scattering Bruneton LUTs, with a bounded solar halo and disk.

Run `npm run verify:webgpu-migration-lab` in Chrome or Edge. The verifier limits Chromium to one renderer process, requires 20 rendered frames and at least one draw call, rejects console/page errors, and writes `verification-webgpu-migration-lab.png` for manual depth/particle inspection.

Three.js r178 `TiledLightsNode.customCacheKey()` dereferences its compute node before first setup. The lab uses a narrow initialization guard and delegates to the original cache key after setup; this is isolated from production code.

Three.js r178 `TRAAPassNode.updateBefore()` also expects its MRT before its lazy setup has run. The lab explicitly supplies the documented `mrt({ output, velocity })` configuration at construction; the resolve, jitter, history and velocity implementation remain the native Three.js TRAA path. This is not the legacy `TAARenderPass`, which has no reprojection.

Migration order:

1. replace the procedural ocean, sky and cloud `ShaderMaterial` implementations with TSL node materials;
2. replace WebGL `EffectComposer` passes with `PostProcessing`, GTAO, TRAA, SSR/Hi-Z and bloom nodes;
3. move froxel, atmosphere and clustered-light resources onto the renderer-owned WebGPU device;
4. replace the 12 Hz particle bridge with storage attributes directly consumed by node materials;
5. validate visual parity, camera cuts, resize, combat event wiring and legal weapon launch paths before making native WebGPU the default Ultra renderer.

The current ocean/sky gate is intentionally a material integration gate, not production parity. FFT and Bruneton resources are generated on the renderer device, read back once and uploaded as Three.js `DataTexture` resources; the verifier labels this `GPU_COMPUTE_READBACK_UPLOAD`, never zero-copy. A local visual-event input drives a decaying, directionally broken impact displacement and foam ring. The same event now drives a 32,768-particle water column: position, velocity and staggered lifetime remain in storage buffers, TSL compute integrates gravity and drag, and `PointsNodeMaterial` consumes the position storage directly with no CPU readback. The next resource step is renderer-owned storage textures and combat-event wiring with blue-noise particle seeds. Cloud shadows, aerial fog and production combat geometry still have to migrate before this can replace the production Ultra ocean.
