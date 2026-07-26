# Guidance

> v1.0.0 · 2026-07-26 | [Mechanics](README.md) | [中文](../../MECHANICS/GUIDANCE.md)

Weapons use explicit phases and never read target truth before seeker acquisition. Platform-supported weapons receive command or datalink updates with cadence, delay, quality, and possible loss. Semi-active weapons require illumination; active-radar weapons transition to their own seeker; infrared weapons resolve heat/aspect/FOV; anti-ship weapons fly route/altitude phases before terminal search.

Kinematics impose acceleration, speed decay, turn-rate/load limits, loft or sea-skimming profiles, seeker FOV, target-loss coast, proximity geometry, and maximum flight time. A miss should emerge from energy, support, geometry, track, or countermeasure failure rather than a hidden global probability cut.
