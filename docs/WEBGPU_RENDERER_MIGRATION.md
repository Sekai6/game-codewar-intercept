# Native WebGPU Renderer Migration

The production scene remains on the validated hybrid WebGL 2 + WebGPU compute path while native renderer parity is built behind `/webgpu-lab.html`.

The first gate proves, on one `WebGPURenderer` and one depth buffer:

- `MeshStandardNodeMaterial` PBR rendering;
- native Three.js tiled lighting with 24 simultaneous point lights;
- TSL compute updating a 32,768-entry `StorageBufferAttribute`;
- direct `PointsNodeMaterial` drawing from that storage attribute without CPU readback;
- normal depth occlusion between storage particles and opaque geometry.
- a TSL ocean material with three-scale analytic wave displacement, matching analytic normals, bounded Fresnel environment energy and local tiled-light response;
- a TSL afternoon sky node with horizon/zenith gradient, Mie-like solar halo and bounded sun disk.

Run `npm run verify:webgpu-migration-lab` in Chrome or Edge. The verifier limits Chromium to one renderer process, requires 20 rendered frames and at least one draw call, rejects console/page errors, and writes `verification-webgpu-migration-lab.png` for manual depth/particle inspection.

Three.js r178 `TiledLightsNode.customCacheKey()` dereferences its compute node before first setup. The lab uses a narrow initialization guard and delegates to the original cache key after setup; this is isolated from production code.

Migration order:

1. replace the procedural ocean, sky and cloud `ShaderMaterial` implementations with TSL node materials;
2. replace WebGL `EffectComposer` passes with `PostProcessing`, GTAO, TRAA, SSR/Hi-Z and bloom nodes;
3. move froxel, atmosphere and clustered-light resources onto the renderer-owned WebGPU device;
4. replace the 12 Hz particle bridge with storage attributes directly consumed by node materials;
5. validate visual parity, camera cuts, resize, combat event wiring and legal weapon launch paths before making native WebGPU the default Ultra renderer.

The current ocean/sky gate is intentionally a material skeleton, not production parity. It still needs the existing FFT displacement/Jacobian atlas, Kelvin wake and splash ring inputs, Bruneton LUT sampling, cloud shadows and fog before it can replace the production Ultra ocean.
