# A-6E Intruder

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/A6E_INTRUDER.md)

All-weather anti-ship strike aircraft with AN/APQ-148 radar and two AGM-84A Harpoons. Game values: cruise/max speed 3.8/5.5, 6.5 g, 950 fuel-seconds, RCS 7, ECM strength 0.52, and 28-unit burn-through range.

Its mission logic favors low-altitude approach, physical hardpoint release, and egress. It does not behave as an air-superiority fighter and has no fighter-style afterburner regime.

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
