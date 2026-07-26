# AIM-54A Phoenix

> Data snapshot: v1.0.0. Historical names are retained; numeric values are game-scaled.

Source: `src/air/catalog.ts`, `src/air/guidance.ts`, `src/air/missile-runtime.ts`.

| Field | Value |
|---|---:|
| Target / seeker | Aircraft / active radar |
| Range | 12-1380 simulation nm |
| Speed / boost | 19 / 6 s |
| Turn limit | 17 deg/s |
| Seeker | 170 nm, 55 deg FOV |
| Mid-course update | 0.8 s via F-14 track |
| Damage / proximity | 72 / 5 nm |

Runtime: `boost -> midcourse -> active-search -> acquired/lost -> terminal`. Before capture it uses only platform track updates. Loft altitude is 210 and active transition range is 360. ECM/chaff compete with seeker quality. Verify with `npm run verify:air-guidance` and inspect AAR state events.

