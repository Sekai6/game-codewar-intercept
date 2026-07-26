# Tu-126 Moss

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/TU126_MOSS.md)

Soviet AEW/controller aircraft represented independently from US network doctrine. It produces controller tracks and GCI cues through the Soviet C2 layer rather than Link 16.

Commands contain estimated intercept points, quality, uncertainty, commanded speed, radar-activation range, delivery delay, and expiry. Receiving fighters still need organic radar and weapon-quality acquisition before firing.

## Game definition

| Field | Value |
|---|---|
| RCS / IR signature | 145 / 1.8 |
| Cruise / max / stall | 3.9 / 5.85 / 1.75 |
| Load / roll / pitch | 2.5 g / 24 deg/s / 7 deg/s |
| Fuel / mass / wing area | 2600 s / 150,000 kg / 311 m² |
| Radar | Liana, rotating 360°, range 795, 7.2 s refresh, precision 0.62 |
| Control | Voice GCI, capacity 1, 4.5 s delay, 16 s life, 0.78 reliability, MiG-29A client |
| EW | ECM 0.58, burn-through 42; 30 chaff, 8 flares |

It has no NATO terminal, stores, or weapon channels. Loss or damage of this independently targetable platform degrades Soviet controller coverage; clients fall back to organic sensors and track memory. GCI commands and platform damage remain visible in AAR/ACMI.
