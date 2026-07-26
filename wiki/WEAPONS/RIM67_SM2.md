# RIM-67 Standard Missile (SM-2ER)

> Data snapshot: v1.0.0. Numeric values are game-scaled.

## Source
`src/interceptor-data.ts`, `src/ship-defense/` and the ship launcher runtime.

| Field | Value |
|---|---:|
| Range (min/max) | 22 / 900 simulation nm |
| Speed / boost | 14.2 / 6.2 s |
| Turn limit | 16 deg/s |
| Terminal guidance | ship track plus radar illumination |
| Terminal range | 190 simulation nm |

SM-2ER is a ship-launched interceptor. A valid engagement reserves a fire-control channel, queues a physical Mk 10/Mk 41 launcher event, opens the cell, separates the round, decrements ammunition, and only then creates the missile entity. It can engage aircraft and inbound anti-ship missiles through the common target-track interface.

## Verification
Use launcher event logs and Tacview object birth to prove a legal launch; `SHIP SAM AUTO LAUNCH` is not a valid path. Run the ship-defense verification suite.

