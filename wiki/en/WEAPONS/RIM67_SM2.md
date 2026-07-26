# RIM-67 Standard Missile (SM-2ER)

> Data snapshot: v1.0.0. Numeric values are game-scaled.

Source: `src/interceptor-data.ts`, `src/ship-defense/`, launcher runtime.

| Field | Value |
|---|---:|
| Range / speed | 22-900 nm / 14.2 |
| Boost / turn limit | 6.2 s / 16 deg/s |
| Terminal range | 190 nm |
| Guidance | ship track plus illumination |

Legal launch requires channel reservation, launcher queue, cell/open-door/separation event and ammunition decrement before missile creation. No `SHIP SAM AUTO LAUNCH` bypass is valid. Verify with launcher logs and Tacview object birth.

