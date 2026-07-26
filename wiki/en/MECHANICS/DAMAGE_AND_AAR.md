# Damage and AAR

> v1.0.0 · 2026-07-26 | [Mechanics](README.md) | [中文](../../MECHANICS/DAMAGE_AND_AAR.md)

Ships and aircraft retain persistent structure and subsystem state. Aircraft track engines, radar, flight controls, and weapon systems; ships expose hull, sensors, fire control, launchers, ECM, countermeasures, CIWS, fire/flooding, and damage control. A damaged entity may continue, disengage, lose capability, become uncontrolled, break up, or crash/sink.

AAR combines fixed-step snapshots with categorized sensor, fire, guidance, effect, maneuver, network, and system events. Tacview export preserves object identity, shooter/parent, target, trajectory, state, network estimate points, and C2 cues. Event text alone is not proof: launch verification also checks magazine change, independent weapon object, initial coordinates, and physical-launch record.
