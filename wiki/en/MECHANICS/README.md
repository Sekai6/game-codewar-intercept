# Mechanics

> v1.0.0 · 2026-07-26

[Wiki home](../README.md) | [中文](../../MECHANICS/README.md)

## Simulation chain

1. Sensors scan on their own refresh schedule and produce uncertain tracks after RCS, horizon, probability, and measurement-error checks.
2. Tracks age, lose quality, and may be shared through era-dependent networks with delay and loss.
3. Each shooter requires an organic, weapon-quality solution; a network cue alone grants no weapon authority.
4. A fire assignment passes through the owning platform's channels, magazine, launcher state machine, and physical release.
5. Weapons use platform support before seeker acquisition, then resolve seeker FOV, ECM, decoy competition, kinematics, fuze geometry, and damage.
6. Snapshots and categorized events enter AAR and Tacview export.

## Topics

- **Sensors and tracks:** radar horizon, RCS fourth-root scaling, scan cadence, noise, uncertainty, quality, and aging.
- **Guidance:** command/datalink midcourse, semi-active illumination, active radar terminal guidance, infrared acquisition, and anti-ship terminal search.
- **Electronic warfare:** ECM strength, burn-through, HOJ, physical chaff/flares/SRBOC, seeker-specific competition, and CIWS.
- **Air dynamics:** three-dimensional velocity integration, drag/lift limits, AoA, stall, load factor, throttle regimes, fuel, and damage effects.
- **Fleet AAW:** independent ships, OTC/AAWC roles, cue-only network picture, organic authorization, independent magazines and physical launchers.
- **Damage and AAR:** subsystem damage, persistent effects, physical launch evidence, replay, events, and ACMI.
- **Telemetry:** 428 runtime diagnostics plus structured snapshots, event streams, network observations, and export data. See [Telemetry](TELEMETRY.md).
