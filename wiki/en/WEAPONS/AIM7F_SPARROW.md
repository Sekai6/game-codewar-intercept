# AIM-7F Sparrow

> Data snapshot: v1.0.0. Numeric values are game-scaled.

Source: `src/air/catalog.ts`, `src/air/guidance.ts`.

| Field | Value |
|---|---:|
| Guidance / target | Semi-active radar / aircraft |
| Range | 5-460 simulation nm |
| Speed / boost | 15 / 4 s |
| Turn limit | 24 deg/s |
| Seeker | 36 nm, 42 deg FOV |
| Illumination/update | Required / 0.4 s |
| Damage / proximity | 64 / 4 nm |

The missile cannot finish terminal guidance if continuous illumination is lost. Radar ECM and chaff matter; flares do not. Verify illumination loss and seeker events with `npm run verify:air-guidance`.

