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

Three.js r178 `TiledLightsNode.customCacheKey()` dereferences its compute node before first setup. The lab uses a narrow initialization guard and delegates to the original cache key after setup; this is isolated from production code.

Three.js r178 `TRAAPassNode.updateBefore()` also expects its MRT before its lazy setup has run. The lab explicitly supplies the documented `mrt({ output, velocity })` configuration at construction; the resolve, jitter, history and velocity implementation remain the native Three.js TRAA path. This is not the legacy `TAARenderPass`, which has no reprojection.

The r178 TRAA pass owns its scene render and does not accept an already shaded input. Sampling its copied/jittered depth from GTAO produced invalid all-white or all-black AO. The validated topology therefore uses a separate hull-only `pass()` for GTAO depth/normal and excludes the displaced ocean and transparent storage particles. This costs an additional geometry pass (the current lab rises from roughly 74 to 124 draw calls with GTAO enabled); merging GTAO into a unified temporal MRT remains a production optimization gate, not a completed claim.

Three.js r178's native `SSRNode` is a fixed one-pixel screen-space loop; source inspection confirms that it does not build or sample a mipmapped depth hierarchy. The lab exposes it only as `ssr=on|debug` with diagnostics `FIXED_STEP_BASELINE_HALF_RES` and `hiz=NOT_YET_CONSUMED`. Debug capture proves ray hits but also shows broken hull slices, screen-edge truncation and transparent spray contamination. The bounded composite adds roughly 55 draw calls with no material visual improvement, so SSR remains off by default and is retained solely as an A/B baseline. It must not be described as Hi-Z SSR; acceptance requires a real min-depth pyramid and hierarchical traversal.

The native Hi-Z resource gate is available with `hiz=on`. It samples the renderer-owned hull depth pass directly from the WebGPU backend, resolves either single-sample or 4x MSAA depth into mip 0, then dispatches 2x2 minimum reductions into a Three-owned `r32float` `StorageTexture` down to 1x1. On the 1280x720 Edge gate this produces 11 levels; mip-0 center depth is about `0.997895` and the final minimum is about `0.997497`. The same mip chain is now sampled directly by TSL with no readback bridge (`hizConsumer=TSL_ZERO_READBACK_MIP_SAMPLING`); `hiz=depth-debug` applies display-only contrast and visibly resolves the hull and superstructure silhouette. Numeric readback remains an acceptance probe only. The r178 TRAA copied depth still returns zero, so Hi-Z deliberately uses the independent opaque hull depth pass. Hierarchical SSR traversal is not yet implemented, and no SSR quality claim is made at this gate.

Migration order:

1. replace the procedural ocean, sky and cloud `ShaderMaterial` implementations with TSL node materials;
2. replace WebGL `EffectComposer` passes with `PostProcessing`, GTAO, TRAA, SSR/Hi-Z and bloom nodes;
3. move froxel, atmosphere and clustered-light resources onto the renderer-owned WebGPU device;
4. replace the 12 Hz particle bridge with storage attributes directly consumed by node materials;
5. validate visual parity, camera cuts, resize, combat event wiring and legal weapon launch paths before making native WebGPU the default Ultra renderer.

The current ocean/sky gate is intentionally a material integration gate, not production parity. FFT and Bruneton resources are generated on the renderer device, read back once and uploaded as Three.js `DataTexture` resources; the verifier labels this `GPU_COMPUTE_READBACK_UPLOAD`, never zero-copy. A local visual-event input drives a decaying, directionally broken impact displacement and foam ring. The same event now drives a 32,768-particle water column: position, velocity and staggered lifetime remain in storage buffers, TSL compute integrates gravity and drag, and `PointsNodeMaterial` consumes the position storage directly with no CPU readback. The next resource step is renderer-owned storage textures and combat-event wiring with blue-noise particle seeds. Cloud shadows, aerial fog and production combat geometry still have to migrate before this can replace the production Ultra ocean.
