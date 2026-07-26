# AIM-54A Phoenix

> Data snapshot: v1.0.0. Names are historical; numeric values are game-scaled.

## Source of truth
`src/air/catalog.ts` (`AIR_WEAPONS["AIM-54A"]`), `src/air/guidance.ts`, and `src/air/missile-runtime.ts`.

## Runtime profile
| Field | Value |
|---|---:|
| Target / seeker | Aircraft / active radar |
| Range (min/max) | 12 / 1380 simulation nm |
| Speed / boost | 19 / 6 s |
| Turn limit | 17 deg/s |
| Terminal seeker | 170 nm, 55 deg FOV |
| Mid-course update | 0.8 s; F-14 data-link track |
| Damage / proximity | 72 / 5 nm |

The state sequence is `boost -> midcourse -> active-search -> acquired/lost -> terminal`. Before active capture, the missile may only use launch-platform track updates; it never reads target truth. Loft altitude is 210 and the active transition window is 360 simulation nm.

## Countermeasures and checks
Radar jamming and chaff compete with seeker quality; burn-through is resolved by the shared guidance runtime. Check `midcourse`, `active-search`, capture/loss, and terminal events in telemetry/Tacview. Run `npm run verify:air-guidance`.

