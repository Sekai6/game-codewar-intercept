# Changelog

> Documentation snapshot: v1.1.0 · 2026-07-26. Later releases may revise these notes.

## 1.1.0 - 2026-07-26

### Changed

- Rebuilt the procedural F-14A, A-6E, MiG-29A, Tu-16K, E-2C, and Tu-126 visual assets in modular `src/air/model-assets/` and `src/air/aew/model-assets/` paths.
- Applied one 2 metres-per-unit display scale to all six aircraft so their relative dimensions remain consistent; this display convention does not change game-scaled flight or weapon parameters.
- Replaced shared-detail aircraft rendering with separately constructed Ultra, High, and Low geometry and quality-aware distance selection.
- Added reference-dimension metadata and model-specific silhouettes: F-14 variable-sweep wings and fixed glove/pallet mounts; A-6 TRAM and five visible pylons; MiG-29 LERX, engine channels, IRST, and three pylon classes; Tu-16 glazed nose, integrated wing-root nacelles, tail turret, and KSR carrier beams.
- Rebuilt E-2C and Tu-126 AEW geometry with animated rotodomes and propellers. The E-2C uses the NTU-era four-blade/four-fin configuration; the Tu-126 uses the larger Liana installation and paired contra-rotating rotor sets on each of four NK-12 engines.
- Aligned mounted AIM-54A/AIM-7F/AIM-9L, AGM-84A, R-27R/R-73, and KSR-5 visuals with platform-owned attachment anchors while preserving entity, ammunition, and release ownership.
- Allowed AEW controllers to issue degraded, cue-only intercept vectors against measured unidentified airborne contacts. Classified aircraft remain preferred; unknown contacts receive lower command quality and higher uncertainty, and no target truth or weapon authority is exposed.

### Added

- An isolated aircraft asset gallery and a serial capture workflow for Ultra, High, Low, variable-wing, and armed hardpoint inspection.
- Structural verification for strict triangle-count reduction, independent geometry ownership, per-tier dimension tolerances, F-14 fixed-mount parentage, surface-marking tier ownership, and AEW propeller/rotodome animation.

### Release Boundaries

- The new assets improve visual proportions, silhouettes, LOD behavior, and store attachment. They do not change the rule that real-world names use game-scaled performance values.
- Static gallery screenshots and model-structure tests do not by themselves validate flight AI, missile lethality, seeker behavior, or the complete joint-combat loop; those require the existing runtime and browser regressions.
- Carrier operations, aerial refueling, CEC, towed decoys, passive sensor/EMCON chains, and anti-radiation warfare remain outside this release.

### Model Verification Evidence

- `npx tsc --noEmit`
- `npm run verify:asset-detail-lod`
- `npm run verify:air-models`
- `npm run verify:aew`
- `npm run verify:air-weapon-models`
- `npm run verify:air-hardpoints`
- `npm run verify:joint-air`
- `npm run verify:aew-runtime`
- `npm run verify:mig29-combat`
- `npm run verify:soviet-maritime-runtime`
- `npm run verify:air-camera` against the production preview
- `npm run build`
- `npm run capture:aircraft-lod-gallery`

## 1.0.0 - 2026-07-26

### Added

- Independent ship, aircraft, missile, and decoy combat entities.
- NTU-era fleet operations with CGN-9 Long Beach and CG-57 Lake Champlain.
- Link 11 era networking, optional Link 16 era configuration, and separate Soviet C2 models.
- Initial runtime/catalog support for F-14A, A-6E, Tu-16K, MiG-29A, E-2C, and Tu-126 air platforms. The refined scale-consistent Ultra/High/Low assets belong to v1.1.0.
- Three-dimensional flight dynamics, advanced flight AI, throttle regimes, fuel, damage, and formations.
- Radar tracks with horizon, RCS, error, aging, ECM, seeker FOV, and burn-through behavior.
- AIM-54A, AIM-7F, AIM-9L, R-27R, R-73, KSR-5, AGM-84A, P-15, P-500, P-700, Kh-22, Harpoon, RIM-67, SM-2MR, and SM-2ER catalog paths.
- Physical Mk 10 and Mk 41 launcher state machines, independent magazines, fire-control channels, and organic launch events.
- Fleet AAWC/OTC tasking, CIWS, ECM, SRBOC, subsystem damage, AAR, and Tacview ACMI export.
- WebGL high-quality environment and capability-gated WebGPU Ultra rendering path.
- Linked Chinese and English entry documentation with automated local-link verification.

### Release Boundaries

- Parameters are game-scaled despite real-world names.
- CEC, carrier operations, aerial refueling, towed decoys, and anti-radiation missiles are not included.
- Link 11/16 cues do not grant weapon authority; CEC is not simulated.
- WebGPU Ultra remains capability- and driver-dependent and must expose fallback status.

### Verification Evidence

- `npm run build`
- `npm run verify:docs`
- `npm run verify:default-platform`
- `npm run verify:default-engagement`
- `npm run verify:fleet-launch-cycle`
- `npm run verify:joint-air`
- `npm run verify:acmi-export`
- `npm run verify:webgpu-ultra`
- `npm run verify:webgpu-ultra-active`
