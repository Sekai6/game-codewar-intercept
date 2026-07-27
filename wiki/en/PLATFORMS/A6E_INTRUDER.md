# A-6E Intruder

> v1.1.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/A6E_INTRUDER.md)

All-weather anti-ship strike aircraft with AN/APQ-148 radar and two AGM-84A Harpoons. Game values: cruise/max speed 3.8/5.5, 6.5 g, 950 fuel-seconds, RCS 7, ECM strength 0.52, and 28-unit burn-through range.

Its mission logic favors low-altitude approach, physical hardpoint release, and egress. It does not behave as an air-superiority fighter and has no fighter-style afterburner regime.

## v1.1 procedural asset

The model uses the 16.69 m length and 16.15 m span relationship on the common 2 m/unit visual scale, with independently constructed Ultra, High, and Low geometry. Identifying features include the blunt radome, side-by-side cockpit, D-shaped shoulder intakes, TRAM turret, swept folding-wing shape, closed wingtip speed brakes, and five visible pylons.

All five pylons are part of the visual asset, while the current gameplay loadout exposes two anti-ship anchors for AGM-84A stores. Mount contact, scale, and roll metadata seat the Harpoons against their rails. A static armed view validates attachment only; missile flight, ECM, and hit behavior require runtime regressions.

## Shape-audit references

The procedural silhouette was checked against the U.S. Naval Air Systems Command A-6E descriptive-arrangement/three-view drawing (the public-domain scan preserved in Wikimedia Commons) and the Smithsonian National Air and Space Museum A-6E Intruder collection record. Those references establish the 54 ft 7 in class length, 53 ft span, side-by-side canopy, blunt drooped radome, D-shaped shoulder intakes, under-nose TRAM turret, swept folding wing with closed tip brakes, single fin, and the short non-afterburning J52 exhausts ahead of the tail.

Ultra now models those openings and curved transitions with its own high-segment lofts; High and Low use reduced station sets and planform points rather than hiding Ultra decoration. The static contract is 8.345 model units length, 8.005 model units registered Ultra span (High 7.995, Low 7.985; wingtip lamps are outside tier roots), and 2.4625 model units visible height without landing gear. The two strike stations expose rail contact metadata so an AGM-84A seats against the visual pylon rather than floating through the wing.

## Game definition

| Field | Value |
|---|---|
| RCS / IR signature | 7 / 1.0 |
| Cruise / max / stall speed | 3.8 / 5.5 / 1.7 |
| Load / roll / pitch limits | 6.5 g / 95 deg/s / 23 deg/s |
| Fuel / mass / wing area | 950 s / 15,500 kg / 49.1 m² |
| Radar | AN/APQ-148: range 340, 1.2 s refresh, 100° FOV, 0.78 precision |
| ECM / burn-through | 0.52 / 28 |
| Countermeasures | 24 chaff, 24 flares, 5 s cooldown |
| Stores | Two AGM-84A, 0.35 s release and 0.3 s ignition delay |

JTIDS Integration is available only in the `link16-modernized` era. Harpoon employment still requires an observed surface track, hardpoint inventory, release authorization, separation, and ignition. Engine/radar/flight-control/weapon damage and all release parentage are retained in AAR/ACMI.

Model source: `src/air/model-assets/us/a6e.ts`.
