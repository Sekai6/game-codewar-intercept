# KSR-5 Kingfish

> Data snapshot: v1.0.0. Numeric values are game-scaled.

Source: `src/air/catalog.ts`, `src/air/missile-runtime.ts`, shared anti-ship guidance.

| Field | Value |
|---|---:|
| Target / guidance | Ship / active anti-ship radar |
| Range | 80-900 simulation nm |
| Speed / boost | 10.4 / 8 s |
| Turn limit | 7 deg/s |
| Altitudes | boost 92, cruise 6, terminal 0.8 |
| Seeker / damage | 125 nm, 50 deg / 48 |

The Tu-16K hardpoint releases the missile, consumes the store, then commands bomber egress. The common runtime applies radar horizon, track quality, ECM, burn-through and decoy competition.

