# USS Lake Champlain (CG-57)

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/USS_LAKE_CHAMPLAIN_CG57.md)

An independent Ticonderoga-class fleet member with local sensors, tracks, channels, magazines, forward/aft Mk 41 banks, ECM, CIWS, maneuver, damage, and AAR identity. It is not a decorative child of the flagship.

Fleet AAW may assign the ship a target, but CG-57 validates its own organic track and launcher availability. Each launch identifies ship, bank, cell, weapon, time, and physical departure point.

## Game definition

| Field | Value |
|---|---|
| Mobility | 32.5 kn max, 22 cruise, 12 patrol; 1.8 deg/s turn |
| Radar | AN/SPY-1B phased array: range 820, 0.42 s refresh; AN/SPS-49: range 1100, 1.05 s refresh |
| Fire control | AN/SPG-62; 6 SAM channels and 4 illuminators |
| SAM inventory | 48 SM-2MR and 32 SM-2ER; forward/aft Mk 41 banks, 64-cell catalog, 0.5 s sequence interval |
| Surface strike | 8 RGM-84; range 35-720, quality 0.58, 2-4 round salvo |
| CIWS/EW | Two Phalanx mounts, 1800 rounds, PK 0.46/0.72; SLQ-32 0.64, burn-through 70, 12 SRBOC |

Each Mk 41 cell transitions through ready, opening, launching, closing, spent, or disabled and retains bank/cell, isolation, interval, and trapped-round diagnostics. Four SPY-1B faces can be damaged by bearing. The procedural model uses a 172.8 m by 16.8 m reference hull scaled at 2.25 m/world unit and includes VLS banks, four arrays, SPG-62, CIWS, hangar, and LODs. Source: `src/models/ticonderoga.ts`, `src/fleet/`, `src/ship-defense/`.
