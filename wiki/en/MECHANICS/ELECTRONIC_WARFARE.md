# Electronic Warfare

> v1.0.0 · 2026-07-26 | [Mechanics](README.md) | [中文](../../MECHANICS/ELECTRONIC_WARFARE.md)

ECM is owned by ships or aircraft and has strength, subsystem health, geometry, and burn-through distance. It affects radar detection/guidance but does not globally reduce every hit chance. Compatible seekers may use home-on-jam; HOJ retains error and does not guarantee a hit.

Chaff, flares, and SRBOC rounds are physical entities with release point, velocity, spread, signal strength, lifetime, and owner. Chaff competes with radar seekers; flares compete with infrared seekers. AI selects programs from warning type, seeker class, time-to-impact, inventory, cooldown, and defensive maneuver state. CIWS is a separate last-layer physical engagement.
