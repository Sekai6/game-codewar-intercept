# MiG-29A Fulcrum-A

> Data snapshot: v1.1.0 · 2026-07-26 | [中文](../../PLATFORMS/MIG29A_FULCRUM.md)

Soviet front-line interceptor using its N019 track store or uncertain Tu-126/GCI cues. It carries four R-27R and two R-73 missiles, has one illumination channel, and never participates in Link 16.

## v1.1 procedural asset

The model uses the 17.32 m length and 11.36 m span relationship on the common 2 m/unit visual scale, with separately built Ultra, High, and Low geometry. Its silhouette includes the 73.5° LERX, 42° main wing, continuous dorsal spine, separate engine channels, auxiliary intake doors, canted twin tails, and IRST.

Six attachment anchors distinguish outer rails, middle pylons, and inner ejectors for compatible R-73/R-27R combinations. Asset verification checks tier dimensions, triangle reduction, geometry independence, pylon classes, and mounted stores; it does not replace semi-active illumination or infrared-acquisition tests.

| Field | Value |
|---|---|
| RCS / IR signature | 5.2 / 1.2 |
| Cruise / max / stall speed | 5.3 / 11.2 / 2.0 |
| Load / roll / pitch limits | 9 g / 150 deg/s / 34 deg/s |
| Fuel / mass / wing area | 720 s / 14,500 kg / 38 m² |
| Radar | N019 Rubin: range 285, 0.9 s refresh, 110° FOV, 0.80 precision |
| ECM / burn-through | 0.46 / 30 |
| Countermeasures | 30 chaff, 30 flares, 2+3 bursts, 4.5 s cooldown |

Afterburner lasts 105 s with 2.11 speed, 1.9 acceleration, 5.1 fuel, and 3.0 IR factors. R-27R requires semi-active illumination; R-73 resolves IR aspect/FOV and physical flares. Engine, radar, controls, stores, and structure can be damaged, and GCI, throttle, weapon parentage, decoys, and damage enter AAR/ACMI.

Model source: `src/air/model-assets/soviet/mig29a.ts`.
