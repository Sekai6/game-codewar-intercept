# AGM-84A Harpoon

> Data snapshot: v1.0.0. Numeric values are game-scaled.

Source: `src/air/catalog.ts`, `src/threats/harpoon.ts`, `src/air/missile-runtime.ts`.

| Field | Value |
|---|---:|
| Range / speed | 25-430 nm / 6.2 |
| Boost / turn limit | 3 s / 12 deg/s |
| Seeker | 115 nm, 50 deg FOV |
| Altitudes | boost 4.5, cruise 0.9, terminal 0.12 |
| Terminal | starts at 130; skim/pop-up |

Released from an A-6E hardpoint, it runs boost, cruise and terminal search. The shared profile models weave, HOJ, burn-through (22) and chaff competition; ECM never teleports or directly steers the missile.

