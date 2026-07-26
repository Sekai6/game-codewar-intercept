# E-2C Hawkeye

> v1.1.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/E2C_HAWKEYE.md)

US carrier AEW aircraft modeled as an independent, targetable air entity. It scans with its own radar cadence and geometry, maintains uncertain controller tracks, and issues intercept cues through era-appropriate Link 4A/voice or tactical-network behavior.

The E-2C does not grant magical weapon authority. Fighters still require their own acquisition and weapon conditions. Damage, loss of radar, network degradation, or destruction removes or degrades its contribution.

## v1.1 procedural asset

The model uses the 17.6 m length and 24.56 m span relationship on the common 2 m/unit visual scale, with independently built Ultra, High, and Low geometry. The represented NTU/AN/APS-125-era configuration includes the high wing, proportioned 7.315 m rotodome, four-fin tail, segmented cockpit glazing, and two four-blade T56 propellers.

Each tier owns its own rotodome and propeller objects, and runtime animation updates the visible tier. Asset verification checks dimensions, triangle reduction, geometry independence, two four-blade propellers, and rotodome animation. It does not by itself establish AEW scanning, Link 4A/Link 11 delivery, or damage-degradation behavior in a scenario.

## Game definition

| Field | Value |
|---|---|
| RCS / IR signature | 14.5 / 1.05 |
| Cruise / max / stall | 3.25 / 4.5 / 1.55 |
| Load / roll / pitch | 3 g / 42 deg/s / 10 deg/s |
| Fuel / mass / wing area | 1800 s / 23,000 kg / 65 m² |
| Radar | AN/APS-125, rotating 360°, range 925, 4.8 s refresh, precision 0.78 |
| Network | Link 11 and NCS capable; reliability 0.90, time sync 0.74 |
| Control | Link 4A, capacity 2, 1.2 s delay, 10 s life, 0.94 reliability, F-14A clients |
| EW | ECM 0.32, burn-through 24; 18 chaff, 12 flares |

It has no stores or weapon channels and remains independently targetable. AAR records controller/client IDs, controller track, estimated intercept point, quality, uncertainty, commanded speed, radar activation range, and expiry. Radar/engine/control/structure damage degrades the corresponding behavior.

Model source: `src/air/aew/model-assets/e2c.ts`.
