# AIM-9L Sidewinder

> Data snapshot: v1.0.0. Numeric values are game-scaled.

Source: `src/air/catalog.ts`, `src/air/guidance.ts`.

| Field | Value |
|---|---:|
| Guidance / target | Infrared / aircraft |
| Range | 2-115 simulation nm |
| Speed / boost | 12 / 3 s |
| Turn limit | 42 deg/s |
| Seeker | 52 nm, 48 deg FOV |
| Damage / proximity | 58 / 3.5 nm |

IR capture depends on aspect, engine heat and background. Flares affect only IR guidance; radar ECM does not. Inspect capture/loss and flare events in telemetry.

