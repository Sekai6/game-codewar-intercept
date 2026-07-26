# Moskva

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/MOSKVA.md)

The Soviet surface platform is an independent combat entity with hull, sensors, track quality, fire-control holdover, physical weapon slots and covers, launch planning, maneuver, ECM/decoys, point defense, damage, and BDA uncertainty.

Weapons reserve a compatible slot, wait for authorization and track conditions, animate cover/release, and acquire their own runtime identity. Planned or reserved rounds do not count as fired.

## Game definition

| Field | Value |
|---|---|
| Mobility | 32 kn max, 20 cruise, 12 patrol; 1.35 deg/s turn |
| Sensors | MR-800 air search range 920/0.9 s; MR-700 surface range 760/0.72 s; Argument fire control 680/0.55 s |
| Strike | 16 P-500 inclined canisters; 0.72 s interval, exit speed 3.8, guidance takeover 4.8 s |
| Authorization | Track quality 0.30, age 2.4 s, fire-control delay 1.6 s, holdover 2.2 s |
| Salvo | 2-8 rounds, maximum 8 in flight, alternate groups, 1.5 s arrival window |
| Defense/EW | 2 point-defense channels, range 42, capacity 6, base PK 0.38; ECM 0.62, burn-through 24, 8 decoys |

Damage zones cover bow, forward, amidships, and aft, affecting search/fire-control radars, canisters, propulsion, EW, decoys, and point defense. Soviet maritime cues, fleet orders, and salvo plans remain uncertain C2 inputs; a specific canister must be reserved, opened, released, and represented as an independent missile before AAR/ACMI counts it as fired. Source: `src/platforms/models/moskva.ts`, `src/platforms/runtime.ts`, `src/soviet-c2/`.
