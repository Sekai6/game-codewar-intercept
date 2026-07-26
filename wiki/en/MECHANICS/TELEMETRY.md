# Telemetry and Analysis

> v1.0.0 · 2026-07-26

[Mechanics](README.md) | [中文](../../MECHANICS/TELEMETRY.md) | [Detailed inventory](../../../docs/zh/TELEMETRY.md)

The runtime exposes 428 unique `canvas.dataset.*` diagnostics. Structured AAR snapshots cover ships, incoming missiles, interceptors, aircraft, air weapons, decoys, datalinks, Soviet C2, fleet state, and AEW commands. Events use seven categories: sensor, fire, guidance, effect, maneuver, network, and system.

Link 11/16 observations expose nodes, tracks, activities, decisions, queue depth, transmission, delivery, loss reasons, and mean delay. Fleet AAR adds assignments, engagements, magazines, station error, and physical launches. ACMI exports six Tacview object classes.

Runtime diagnostics are intended for monitoring and regression tests. They are not all persisted, and rendering diagnostics are not combat truth. v1.0.0 does not yet provide generic CSV, JSON, Parquet, or database export.
