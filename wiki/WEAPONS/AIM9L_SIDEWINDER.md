# AIM-9L Sidewinder

> Data snapshot: v1.0.0. Numeric values are game-scaled.

## Source
`src/air/catalog.ts` and `src/air/guidance.ts`.

## Runtime profile
| Field | Value |
|---|---:|
| Guidance / target | Infrared / aircraft |
| Range (min/max) | 2 / 115 simulation nm |
| Speed / boost | 12 / 3 s |
| Turn limit | 42 deg/s |
| Seeker | 52 nm, 48 deg FOV |
| Damage / proximity | 58 / 3.5 nm |

After boost the seeker searches the IR field of view. Engine damage lowers target heat; afterburner raises it. Flares compete only with IR guidance and do not change radar tracks. Capture can be lost when aspect, background or countermeasure score exceeds the seeker margin.

## Verification
Check IR capture/loss, flare deployment and proximity-fuze events in telemetry. Run `npm run verify:air-guidance`.

