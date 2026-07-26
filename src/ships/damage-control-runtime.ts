import * as THREE from "three";
import type { SubsystemId } from "../ship-types.js";
import type { ShipCombatantInstance } from "./types.js";

export interface ShipDamageEvent {
  shipId: string;
  time: number;
  kind: "impact" | "fire" | "flooding" | "system-failure" | "disabled";
  hullIntegrity: number;
  subsystem?: SubsystemId;
  amount: number;
}

const clamp = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));

function damageSystem(ship: ShipCombatantInstance, id: SubsystemId, amount: number) {
  const before = ship.subsystemHealth.get(id) ?? 100;
  const after = clamp(before - amount);
  ship.subsystemHealth.set(id, after);
  return before > 5 && after <= 5;
}

export class ShipDamageControlRuntime {
  private readonly events: ShipDamageEvent[] = [];

  applyImpact(ship: ShipCombatantInstance, damage: number, hitPoint: THREE.Vector3, now: number) {
    if (!ship.alive || damage <= 0) return;
    const local = ship.model.worldToLocal(hitPoint.clone());
    const longitudinal = clamp(
      local.x,
      -ship.definition.damageModel.longitudinalLimit,
      ship.definition.damageModel.longitudinalLimit,
    );
    const zone = ship.definition.damageModel.zones.find((candidate) => longitudinal >= candidate.minX)
      ?? ship.definition.damageModel.zones[ship.definition.damageModel.zones.length - 1];
    const systems = zone?.systems ?? [];
    const hullDamage = damage * (0.72 + Math.min(0.18, Math.abs(local.y) * 0.006));
    ship.hullIntegrity = clamp(ship.hullIntegrity - hullDamage);
    ship.damageControl.lastImpactAt = now;
    ship.damageControl.casualtyCount++;
    ship.damageControl.damageControlCapacity = clamp(ship.damageControl.damageControlCapacity - damage * 0.18);
    ship.damageControl.fireIntensity = clamp(ship.damageControl.fireIntensity + damage * (local.y > 1 ? 0.42 : 0.24));
    ship.damageControl.flooding = clamp(ship.damageControl.flooding + damage * (local.y <= 2 ? 0.48 : 0.14));

    systems.forEach((system, index) => {
      const failed = damageSystem(ship, system, damage * (index === 0 ? 0.78 : 0.34));
      if (failed) this.record(ship, now, "system-failure", damage, system);
    });
    this.record(ship, now, "impact", damage);
    this.updateDisposition(ship, now);
  }

  update(ship: ShipCombatantInstance, now: number, dt: number) {
    if (!ship.alive || dt <= 0) return;
    const state = ship.damageControl;
    const control = state.damageControlCapacity / 100;
    const fireBefore = state.fireIntensity;
    const floodBefore = state.flooding;
    state.fireIntensity = clamp(state.fireIntensity + dt * (state.fireIntensity * 0.004 - 1.05 * control));
    state.flooding = clamp(state.flooding + dt * (state.flooding * 0.0025 - 0.52 * control));
    const progressive = dt * (state.fireIntensity * 0.006 + state.flooding * 0.008);
    if (progressive > 0) ship.hullIntegrity = clamp(ship.hullIntegrity - progressive);
    if (state.fireIntensity > 20) {
      damageSystem(ship, "fireControl", dt * state.fireIntensity * 0.003);
      damageSystem(ship, "ecm", dt * state.fireIntensity * 0.002);
    }
    if (state.flooding > 18) damageSystem(ship, "propulsion", dt * state.flooding * 0.004);
    const propulsion = (ship.subsystemHealth.get("propulsion") ?? 0) / 100;
    ship.commandedSpeedKnots = Math.min(ship.commandedSpeedKnots, ship.definition.platform.maxSpeedKnots * propulsion);
    if (Math.floor(fireBefore / 20) !== Math.floor(state.fireIntensity / 20)) this.record(ship, now, "fire", state.fireIntensity);
    if (Math.floor(floodBefore / 20) !== Math.floor(state.flooding / 20)) this.record(ship, now, "flooding", state.flooding);
    this.updateDisposition(ship, now);
  }

  diagnostics() { return [...this.events]; }
  reset() { this.events.length = 0; }

  private updateDisposition(ship: ShipCombatantInstance, now: number) {
    if (ship.hullIntegrity > 0 && ship.damageControl.flooding < 100) return;
    ship.alive = false;
    ship.maneuverMode = "disabled";
    ship.commandedSpeedKnots = 0;
    this.record(ship, now, "disabled", 100);
  }

  private record(ship: ShipCombatantInstance, time: number, kind: ShipDamageEvent["kind"], amount: number, subsystem?: SubsystemId) {
    this.events.push({ shipId: ship.id, time, kind, hullIntegrity: ship.hullIntegrity, subsystem, amount });
  }
}
