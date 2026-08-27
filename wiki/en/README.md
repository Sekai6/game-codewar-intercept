# NTU Intercept Wiki

[Chinese Wiki](../README.md) | [Repository](../../README_EN.md)

This Wiki documents the implemented 3D Cold War naval and air-intercept simulation. Historical names provide context; all performance values are game-scaled.

## Contents

- [Mechanics](MECHANICS/README.md)
- [Platforms](PLATFORMS/README.md)
- [Weapons](WEAPONS/README.md)
- [Scenarios](SCENARIOS/README.md)
- [Music and atmosphere](MUSIC.md)
- [Versioning](VERSIONING.md)

## Implemented capability map

**Passive sensing / emission-control chain**: implemented through IRST, ESM, passive tracks and platform-level ACTIVE/EMCON/PASSIVE_ONLY states. See [Passive sensors and EMCON](MECHANICS/PASSIVE_SENSORS_EMCON.md).

**CEC (Cooperative Engagement Capability)**: implemented as a separate measurement-fusion layer. Only the explicit `cec-enabled` era registers Long Beach, CG-57 and E-2C. See [CEC](MECHANICS/CEC.md).

**Anti-radiation operations and missiles**: roadmap item; passive emitter tracks and EMCON are available, but dedicated anti-radiation weapons are not yet implemented.

## Newly documented systems

- [Scenario platform](SCENARIOS/SCENARIO_PLATFORM.md) — JSON schema, validation, compilation and legacy adapters.
- [Telemetry and Tacview](MECHANICS/TELEMETRY_PIPELINE.md) — shared event model for HUD, AAR, analytics and ACMI.
- [AIM-54X CEC](WEAPONS/AIM54X_CEC.md) — future-only network-native Phoenix variant.
