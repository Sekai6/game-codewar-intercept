# AGM-84A Harpoon

> Data snapshot: v1.0.0. Numeric values are game-scaled.

## Source
`src/air/catalog.ts`, `src/threats/harpoon.ts`, and `src/air/missile-runtime.ts`.

## Flight profile
| Field | Value |
|---|---:|
| Target / guidance | Ship / active anti-ship radar |
| Range (min/max) | 25 / 430 simulation nm |
| Speed / boost | 6.2 / 3 s |
| Turn limit | 12 deg/s |
| Seeker | 115 nm, 50 deg FOV |
| Altitudes | boost 4.5, cruise 0.9, terminal 0.12 |
| Terminal | starts at 130; skim/pop-up program |

The missile is launched from an A-6E hardpoint and follows `boost -> cruise -> terminal search`. Terminal modes include sea-skim and pop-up; the shared profile also models weave, HOJ, burn-through (22) and chaff competition. ECM never directly changes the missile position.

## Verification
Check hardpoint release, terminal mode, seeker capture/loss, HOJ and damage events in telemetry/Tacview.

