# AIM-7F Sparrow

> Data snapshot: v1.0.0. Numeric values are game-scaled.

## Source
`src/air/catalog.ts` (`AIM-7F`) and `src/air/guidance.ts`.

## Runtime profile
| Field | Value |
|---|---:|
| Guidance / target | Semi-active radar / aircraft |
| Range (min/max) | 5 / 460 simulation nm |
| Speed / boost | 15 / 4 s |
| Turn limit | 24 deg/s |
| Seeker | 36 nm, 42 deg FOV |
| Illumination | F-14/MiG-29 channel required; update 0.4 s |
| Damage / proximity | 64 / 4 nm |

The missile uses `boost -> midcourse -> terminal`. It cannot complete terminal guidance when the launching aircraft loses continuous illumination. Track age, pointing error, ECM and chaff affect the radar solution; flares do not.

## Verification
Inspect illumination start/stop and seeker loss events in AAR. Run `npm run verify:air-guidance`.

