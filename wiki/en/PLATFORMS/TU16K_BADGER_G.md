# Tu-16K Badger-G

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/TU16K_BADGER_G.md)

Soviet maritime-strike bomber with Rubin-1K radar and one centerline KSR-5. Game values: cruise/max speed 4.2/5.4, 2.5 g, 1300 fuel-seconds, RCS 28, ECM strength 0.68, and 48-unit burn-through range.

It follows approach and release orders, launches through its physical hardpoint, then turns away. Defensive maneuver is deliberately limited by bomber aerodynamics; it may use ECM, chaff, and flares but has no Link 16 or fighter-style afterburner.

## Game definition

| Field | Value |
|---|---|
| RCS / IR signature | 28 / 1.35 |
| Cruise / max / stall speed | 4.2 / 5.4 / 1.8 |
| Load / roll / pitch limits | 2.5 g / 38 deg/s / 10 deg/s |
| Fuel / mass / wing area | 1300 s / 76,000 kg / 164.7 m² |
| Radar | Rubin-1K: range 600, 1.5 s refresh, 100° FOV, 0.70 precision |
| ECM / burn-through | 0.68 / 48 |
| Countermeasures | 42 chaff, 18 flares, 4+2 bursts, 4.5 s cooldown |
| Store | One centerline KSR-5, 0.65 s release and 0.8 s ignition delay |

The platform receives Soviet GCI/maritime/fleet cues, never Link 16. Cue delivery does not authorize launch. Its 13° critical AoA, 1.4 s control response, and 7.2 s engine spool prevent fighter-like defensive turns. AAR preserves command, salvo, release-owner, missile, and damage evidence.
