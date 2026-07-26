# Scenarios

> v1.0.0 · 2026-07-26

[Wiki home](../README.md) | [中文](../../SCENARIOS/README.md)

The default naval scenario exercises radar detection, uncertain tracks, shipboard SAM assignment, physical launchers, terminal seekers, EW, CIWS, and AAR. The optional naval-force mode adds CG-57 as an independent companion rather than a visual attachment.

The joint-air scenario combines F-14 CAP, Tu-16K maritime strike, A-6E anti-ship attack, AEW/GCI control, air-to-air weapons, aircraft countermeasures, shipboard SAM engagement, and surviving-aircraft maneuver. Era controls select Link 11 as the NTU baseline and permit later Link 16 behavior only where configured.

Scenario initial positions, ammunition, threat spacing, and engagement settings live under `src/scenarios/`; platform behavior remains in platform-owned runtimes.
