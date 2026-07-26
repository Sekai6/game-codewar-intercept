# Platforms

> v1.1.0 · 2026-07-26

[Wiki home](../README.md) | [中文](../../PLATFORMS/README.md)

## Ships

- **USS Long Beach (CGN-9):** NTU-era flagship with independent sensors, Mk 10 launchers, magazines, illuminators, ECM, SRBOC, CIWS, movement, and damage.
- **USS Lake Champlain (CG-57):** Ticonderoga-class companion with independent Mk 41 forward/aft banks, local tracks, weapon channels, magazines, ECM, CIWS, and damage.
- **Moskva:** independently modeled Soviet launch platform with physical weapon slots, covers, fire-control track requirements, release scheduling, and BDA behavior.

## Aircraft

| Platform | Role | Mission | RCS | Cruise/max speed | Max g | Radar | Loadout |
|---|---|---|---:|---:|---:|---|---|
| F-14A | Fleet air defense | CAP | 8.0 | 5.1 / 11.5 | 7.5 | AN/AWG-9 | 4 AIM-54A, 2 AIM-7F, 2 AIM-9L |
| Tu-16K | Maritime strike | Anti-ship | 28.0 | 4.2 / 5.4 | 2.5 | Rubin-1K | 1 KSR-5 |
| A-6E | All-weather strike | Anti-ship | 7.0 | 3.8 / 5.5 | 6.5 | AN/APQ-148 | 2 AGM-84A |
| MiG-29A | Front-line fighter | Intercept | 5.2 | 5.3 / 11.2 | 9.0 | N019 Rubin | 4 R-27R, 2 R-73 |

E-2C Hawkeye and Tu-126 Moss are AEW entities with their own flight state, radar scan, track store, command behavior, damage, and datalink/C2 boundaries. Soviet aircraft do not receive Link 16.

v1.1.0 puts all six aircraft on one 2 m/unit visual scale and gives each aircraft independently constructed Ultra, High, and Low geometry. Relative size, silhouette, attachment anchors, and AEW animation are part of the asset acceptance scope; flight AI, weapon outcomes, and joint combat still require separate runtime evidence.

## v1.1.0 model acceptance focus

| Platform | Shape and animation focus | Store/function boundary |
|---|---|---|
| F-14A | 20°–68° variable-sweep wings, twin nacelles, twin tails | Glove pylons and fuselage pallets stay fixed to the airframe |
| A-6E | Side-by-side cockpit, D-shaped intakes, TRAM, five visible pylons | Two current strike anchors carry AGM-84A stores |
| MiG-29A | LERX, continuous spine, separate engine channels, IRST | Six stations use outer-rail, middle-pylon, and inner-ejector classes |
| Tu-16K | Glazed nose, wing-root nacelles, tail turret | Two KSR-compatible wing anchors share the aircraft's actual inventory |
| E-2C | Four-blade propellers, four-fin tail, rotating rotodome | Independent unarmed AEW entity |
| Tu-126 | Large Tu-114-derived airframe and Liana rotodome | Four engines, each with paired contra-rotating four-blade rotor sets; no stores |

Every platform page now includes source-aligned mobility, sensor, weapon, EW, damage, AI, AAR, and model details. The platform catalog is a game implementation reference; historical names do not make its scaled values real-world performance data.
