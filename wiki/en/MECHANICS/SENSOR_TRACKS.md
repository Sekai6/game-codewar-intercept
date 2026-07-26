# Sensors and Tracks

> v1.0.0 · 2026-07-26 | [Mechanics](README.md) | [中文](../../MECHANICS/SENSOR_TRACKS.md)

Detection is scan-driven, not continuous. Effective range is modified by target RCS, radar horizon, aspect/environment rules, sensor health, and a deterministic probability roll. A successful detection creates an estimated position and velocity with quality and uncertainty rather than exposing truth coordinates.

Tracks age between scans: quality falls, uncertainty grows, and stale tracks expire. Classification depends on quality. Shared tracks retain source, age, uncertainty, and network penalties. Weapon authorization requires an organic weapon-quality track; a network cue can direct search but cannot substitute for local fire control.
