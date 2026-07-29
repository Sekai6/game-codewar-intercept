# Platforms

> v1.15.0 · 2026-07-29

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

v1.15.0 applies a second refinement pass on top of the common 2 m/unit visual scale and independently constructed Ultra, High, and Low geometry. Relative size, silhouette, store contact, outward normals, nozzles, and AEW animation are part of the asset acceptance scope; flight AI, weapon outcomes, and joint combat still require separate runtime evidence.

## v1.15.0 model acceptance focus

| Platform | Shape and animation focus | Store/function boundary |
|---|---|---|
| F-14A | 20°–68° variable-sweep wings, twin nacelles, twin tails | Glove pylons and fuselage pallets stay fixed to the airframe |
| A-6E | Side-by-side cockpit, D-shaped intakes, TRAM, five visible pylons | Two current strike anchors carry AGM-84A stores |
| MiG-29A | LERX, continuous spine, separate engine channels, IRST | Six stations use outer-rail, middle-pylon, and inner-ejector classes |
| Tu-16K | Glazed nose, wing-root nacelles, tail turret | Two KSR-compatible wing anchors share the aircraft's actual inventory |
| E-2C | Four-blade propellers, four-fin tail, rotating rotodome | Independent unarmed AEW entity |
| Tu-126 | Large Tu-114-derived airframe and Liana rotodome | Four engines, each with paired contra-rotating four-blade rotor sets; no stores |

## Tier geometry and visual gate

These are the structural verifier's visible platform-geometry counts, excluding mounted weapons. High must remain below 60% of Ultra and Low below 50% of High; every tier must also own independent geometry and remain inside its reference-dimension tolerance.

| Platform | Ultra triangles | High triangles | Low triangles |
|---|---:|---:|---:|
| F-14A | 12,846 | 5,748 | 1,956 |
| A-6E | 11,400 | 5,304 | 1,896 |
| MiG-29A | 13,288 | 5,756 | 1,996 |
| Tu-16K | 18,440 | 7,684 | 1,844 |
| E-2C | 20,040 | 7,140 | 1,840 |
| Tu-126 | 36,568 | 11,108 | 2,888 |

`npm run capture:aircraft-lod-gallery` strictly reuses one page and one Chromium renderer to capture 63 acceptance images in sequence. Manual review covers front, side, top, underside, and rear-quarter silhouettes; F-14 20°/68° sweep; store direction and rail contact; nozzles, arresting hooks, tail guns, markings, lights, propellers, and rotodomes. Browser errors must remain at zero.

Every platform page now includes source-aligned mobility, sensor, weapon, EW, damage, AI, AAR, and model details. The platform catalog is a game implementation reference; historical names do not make its scaled values real-world performance data.
