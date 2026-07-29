# F-14A Tomcat

> v1.15.0 · 2026-07-29 | [Platforms](README.md) | [中文](../../PLATFORMS/F14A_TOMCAT.md)

Fleet-air-defense CAP fighter with AN/AWG-9 radar and 4 AIM-54A, 2 AIM-7F, and 2 AIM-9L. Game flight values include cruise/max speed 5.1/11.5, 7.5 g, 120 deg/s roll, 28 deg/s pitch, 900 fuel-seconds, RCS 8, and infrared signature 1.1.

The AI performs track-based OODA, BVR launch-zone evaluation, illumination/channel management, formation behavior, energy-limited maneuver, threat response, countermeasure release, and fuel-aware cruise/military/afterburner selection. Variable-sweep wings and tail effects follow aircraft state.

## v1.1 procedural asset

The model uses the 19.13 m length and 19.55 m maximum-span relationship on the common 2 m/unit visual scale. Ultra, High, and Low are independently constructed geometry and retain the reference silhouette within tier-specific tolerances. The close tier includes the tandem canopy, twin nacelles and tails, stabilators, ventral fins, and tier-owned markings.

Wing sweep moves continuously from 20° to 68°. Glove pylons and four fuselage pallets belong to a fixed airframe weapon rig rather than either wing pivot, preventing AIM-54A/AIM-7F/AIM-9L stores from rotating with the wing or floating away from the mount. Asset tests cover tier reduction, geometry independence, dimensions, marking ownership, and mount parentage; they do not establish Phoenix lethality.

## Game definition

| Field | Value |
|---|---|
| RCS / IR signature | 8 / 1.1 |
| Cruise / max / stall speed | 5.1 / 11.5 / 2.1 |
| Load / roll / pitch limits | 7.5 g / 120 deg/s / 28 deg/s |
| Fuel | 900 simulation seconds |
| Radar | AN/AWG-9: range 1750, 0.8 s refresh, 120° FOV, 0.88 precision |
| ECM / burn-through | 0.56 / 35 |
| Countermeasures | 30 chaff, 30 flares, 2+2 bursts, 5 s cooldown |
| Channels / stores | 6 datalink, 1 illumination; 4 Phoenix, 2 Sparrow, 2 Sidewinder |

Afterburner is available for 150 s with 2.25 speed, 1.72 acceleration, 4.6 fuel, and 2.7 IR factors. Aerodynamic reference mass is 22,000 kg, wing area 52.5 m², and critical AoA 20°. JTIDS is era-gated at `jtids-transition`; it never replaces organic weapon conditions. Engine, radar, flight-control, weapon-system, and structure damage feed mission decisions and AAR telemetry.

Model source: `src/air/model-assets/us/f14a.ts`.
