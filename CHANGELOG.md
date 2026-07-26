# Changelog

> Documentation snapshot: v1.0.0 · 2026-07-26. Later releases may revise these notes.

## 1.0.0 - 2026-07-26

### Added

- Independent ship, aircraft, missile, and decoy combat entities.
- NTU-era fleet operations with CGN-9 Long Beach and CG-57 Lake Champlain.
- Link 11 era networking, optional Link 16 era configuration, and separate Soviet C2 models.
- F-14A, A-6E, Tu-16K, MiG-29A, E-2C, and Tu-126 air platforms.
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
