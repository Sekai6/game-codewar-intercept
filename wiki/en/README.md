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

## Future roadmap

**Passive sensing / emission-control chain**: add IRST, passive electromagnetic detection, emitter tracks and EMCON states to fleet and air-asset platforms. This is not implemented in the current runtime; planned scope covers silent search, emission exposure, passive-track quality, active/passive sensor switching and engagement-authority effects.

**CEC (Cooperative Engagement Capability)**: extend ordinary track sharing into cross-platform sensor fusion, remote fire-control solutions, engagement authorization and coordinated mid-course missile updates. CEC is not the same as the current data-link track exchange and is not implemented.

**Anti-radiation operations and missiles**: model emitter identities, passive direction finding, shutdown/evasion, decoy emitters and a dedicated anti-radiation missile seeker state machine. This depends on passive tracks and EMCON; no anti-radiation missile entity exists yet.
