# Native WebGPU Renderer Migration

The production scene remains on the validated hybrid WebGL 2 + WebGPU compute path while native renderer parity is built behind `/webgpu-lab.html`.

The first gate proves, on one `WebGPURenderer` and one depth buffer:

- `MeshStandardNodeMaterial` PBR rendering;
- native Three.js tiled lighting with 24 simultaneous point lights;
- TSL compute updating a 32,768-entry `StorageBufferAttribute`;
- direct `PointsNodeMaterial` drawing from that storage attribute without CPU readback;
- normal depth occlusion between storage particles and opaque geometry.
- native TRAA with velocity MRT, camera jitter, history reprojection, 3x3 neighborhood clamping and luminance weighting;
- native half-resolution 16-sample GTAO driven by a hull-only depth/normal pass, with bounded `[0.68, 1.0]` compositing so transparent spray and displaced ocean geometry cannot contaminate ambient occlusion;
- a TSL ocean material sampling the 16-frame 64x64 Tessendorf FFT displacement/Jacobian atlas, plus a ship-aligned Kelvin/bow-wave local displacement and foam field;
- a TSL afternoon sky sampling the transmittance, single-scattering and multiple-scattering Bruneton LUTs, with a bounded solar halo and disk.

Run `npm run verify:webgpu-migration-lab` in Chrome or Edge. The verifier limits Chromium to one renderer process, requires 20 rendered frames and at least one draw call, rejects console/page errors, and writes `verification-webgpu-migration-lab.png` for manual depth/particle inspection.

Run `npm run verify:webgpu-temporal-stability` for the controlled temporal A/B. It freezes the ocean, wake, splash simulation and dynamic lights, moves one emissive fast target by a fixed amount per rendered frame, and serially captures frames 40 and 42 with TRAA off/on. The gate measures high-energy residue at the old target position relative to current-target energy, requires at least a 5% improvement without reducing target energy, and saves four images for manual ghosting inspection. Whole-screen frame delta is diagnostic only because TRAA jitter intentionally changes subpixel coverage. On the current Edge/NVIDIA validation, the old-position ratio fell from about 25.44% to 22.34% (12.19% relative improvement) over 27.3 pixels of travel without a visible trail.

Do not use `PassNode.setResolution(0.67)` as TAAU. An Edge A/B showed that r178 resolves TRAA at the reduced history size and then performs ordinary texture enlargement: hull lighting split into large rectangular bands, emissive regions trailed, and the storage-particle column lost fine structure. True TAAU still requires a full-resolution resolve target with low-resolution current color/velocity inputs, output-pixel jitter reconstruction, and disocclusion-aware history sampling.

Three.js r178 `TiledLightsNode.customCacheKey()` dereferences its compute node before first setup. The lab uses a narrow initialization guard and delegates to the original cache key after setup; this is isolated from production code.

Three.js r178 `TRAAPassNode.updateBefore()` also expects its MRT before its lazy setup has run. The lab explicitly supplies the documented `mrt({ output, velocity })` configuration at construction; the resolve, jitter, history and velocity implementation remain the native Three.js TRAA path. This is not the legacy `TAARenderPass`, which has no reprojection.

The r178 TRAA pass owns its scene render and does not accept an already shaded input. Sampling its copied/jittered depth from GTAO produced invalid all-white or all-black AO. The validated topology therefore uses a separate hull-only `pass()` for GTAO depth/normal and excludes the displaced ocean and transparent storage particles. This costs an additional geometry pass (the current lab rises from roughly 74 to 124 draw calls with GTAO enabled); merging GTAO into a unified temporal MRT remains a production optimization gate, not a completed claim.

Three.js r178's native `SSRNode` is a fixed one-pixel screen-space loop; source inspection confirms that it does not build or sample a mipmapped depth hierarchy. The lab exposes it only as `ssr=on|debug` with diagnostics `FIXED_STEP_BASELINE_HALF_RES` and `hiz=NOT_YET_CONSUMED`. Debug capture proves ray hits but also shows broken hull slices, screen-edge truncation and transparent spray contamination. The bounded composite adds roughly 55 draw calls with no material visual improvement, so SSR remains off by default and is retained solely as an A/B baseline. It must not be described as Hi-Z SSR; acceptance requires a real min-depth pyramid and hierarchical traversal.

The controlled `ssrTest=on` preset freezes the sea to a flat low-roughness receiver, lowers the camera, disables particle updates, and removes hull/deck metalness so the baseline cannot pass by reflecting on the ship itself. Its fixed-step debug capture produces a continuous inverted hull near the lower center, but also two large false-hit strips near the horizon. This is the authoritative SSR acceptance composition: hierarchical SSR must preserve the central reflected hull while removing the horizon strips before it can be enabled on the FFT sea.

The native Hi-Z resource gate is available with `hiz=on`. It samples the renderer-owned hull depth pass directly from the WebGPU backend, resolves either single-sample or 4x MSAA depth, and linearizes device depth into positive view-space distance before writing mip 0. It then dispatches 2x2 min/max reductions into a Three-owned `rg32float` `StorageTexture` down to 1x1. On the 1280x720 Edge gate this produces 11 levels; the hull center is about `43.40m`, while the final interval is approximately `[37.01m, 499.97m]` for a 500m far plane. The same mip chain is sampled directly by TSL with no readback bridge (`hizConsumer=TSL_ZERO_READBACK_MIP_SAMPLING`). `hiz=depth-debug` shows mip 0; `hiz=range-debug` visualizes mip 4 interval occupancy and confirms that near hull and far background bounds propagate independently. Numeric readback remains an acceptance probe only. The r178 TRAA copied depth still returns zero, so Hi-Z deliberately uses the independent opaque hull depth pass. Hierarchical SSR interval traversal is not yet implemented, and no SSR quality claim is made at this gate.

The native Froxel gate now uses a renderer-owned `Storage3DTexture` at `120x68x48`. A WebGPU compute pass reconstructs each froxel from the camera inverse projection and world transform, uses logarithmic view-distance slices, injects the 24 actual point lights, and integrates sea mist, marine layer, cloud base and warm explosion smoke. The TSL pass samples the volume with trilinear filtering and stops at the opaque scene depth; no CPU readback is used for rendering. `froxel=debug` on the controlled explosion preset shows a continuous world-space orange volume with no horizontal cell bands, while `froxel=on` preserves the hull and storage-particle silhouette. Dawn reports `errors: []` and the center half-float probe is non-zero. The feature remains an opt-in migration gate because r178's post-processing node graph does not yet expose a stable HDR optical-depth composite; production Ultra stays unchanged until the dynamic transmittance channel and temporal reprojection are validated together. The serial verifier accepts `FROXEL=off|on|debug` and `FROXEL_TEST=on` for identical off/on screenshots.

Migration order:

1. replace the procedural ocean, sky and cloud `ShaderMaterial` implementations with TSL node materials;
2. replace WebGL `EffectComposer` passes with `PostProcessing`, GTAO, TRAA, SSR/Hi-Z and bloom nodes;
3. move froxel, atmosphere and clustered-light resources onto the renderer-owned WebGPU device;
4. replace the 12 Hz particle bridge with storage attributes directly consumed by node materials;
5. validate visual parity, camera cuts, resize, combat event wiring and legal weapon launch paths before making native WebGPU the default Ultra renderer.

The current ocean/sky gate is intentionally a material integration gate, not production parity. FFT and Bruneton resources are generated on the renderer device, read back once and uploaded as Three.js `DataTexture` resources; the verifier labels this `GPU_COMPUTE_READBACK_UPLOAD`, never zero-copy. A local visual-event input drives a decaying, directionally broken impact displacement and foam ring. The same event now drives a 32,768-particle water column: position, velocity and staggered lifetime remain in storage buffers, TSL compute integrates gravity and drag, and `PointsNodeMaterial` consumes the position storage directly with no CPU readback. The next resource step is renderer-owned storage textures and combat-event wiring with blue-noise particle seeds. Cloud shadows, aerial fog and production combat geometry still have to migrate before this can replace the production Ultra ocean.
