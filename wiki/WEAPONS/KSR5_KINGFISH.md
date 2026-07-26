# KSR-5 Kingfish

> Data snapshot: v1.0.0. Numeric values are game-scaled.

## Source
`src/air/catalog.ts` (`KSR-5`), `src/air/missile-runtime.ts`, and the shared anti-ship guidance bridge.

## Flight and seeker
| Field | Value |
|---|---:|
| Target / guidance | Ship / active anti-ship radar |
| Range (min/max) | 80 / 900 simulation nm |
| Speed / boost | 10.4 / 8 s |
| Turn limit | 7 deg/s |
| Seeker | 125 nm, 50 deg FOV |
| Altitudes | boost 92, cruise 6, terminal 0.8 |
| Damage / proximity | 48 / 8 nm |

The flight envelope is `boost -> cruise sea-skimming -> terminal search`. It is released only through a Tu-16K hardpoint, consumes its store, and then turns the bomber away. Ship radar tracks, horizon masking, ECM, burn-through and decoys are resolved by the existing anti-ship runtime.

## Verification
Confirm physical hardpoint separation, terminal seeker acquisition and ship hit/damage events in AAR/Tacview.

