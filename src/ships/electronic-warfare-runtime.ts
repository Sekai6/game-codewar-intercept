import * as THREE from "three";
import type { ShipCombatantInstance, ShipRadarDecoy } from "./types.js";

export interface ShipCountermeasureSnapshot {
  ecmEnabled: boolean;
  ecmStrength: number;
  ecmHealth: number;
  burnThroughRange: number;
  decoys: readonly { position: THREE.Vector3; rcs: number }[];
}

export class ShipElectronicWarfareRuntime {
  private serial = 0;

  update(ship: ShipCombatantInstance, dt: number) {
    for (const decoy of ship.electronicWarfare.decoys) {
      if (!decoy.alive) continue;
      decoy.age += dt;
      decoy.position.addScaledVector(decoy.velocity, dt);
      decoy.velocity.multiplyScalar(Math.max(0, 1 - dt * 0.18));
      decoy.velocity.y -= dt * 0.035;
      decoy.radarCrossSection = ship.electronicWarfare.decoyRcs
        * Math.max(0, 1 - decoy.age / decoy.lifeSeconds);
      if (decoy.age >= decoy.lifeSeconds) decoy.alive = false;
    }
  }

  snapshot(ship: ShipCombatantInstance): ShipCountermeasureSnapshot {
    const ecmHealth = (ship.subsystemHealth.get("ecm") ?? 0) / 100;
    return {
      ecmEnabled: ship.alive && ship.electronicWarfare.ecmEnabled && ecmHealth > 0.05,
      ecmStrength: ship.electronicWarfare.ecmStrength,
      ecmHealth,
      burnThroughRange: ship.electronicWarfare.burnThroughRange,
      decoys: ship.electronicWarfare.decoys
        .filter((decoy) => decoy.alive && decoy.radarCrossSection > 0.05)
        .map((decoy) => ({ position: decoy.position, rcs: decoy.radarCrossSection })),
    };
  }

  deploy(
    ship: ShipCombatantInstance,
    threatPosition: THREE.Vector3,
    now: number,
  ): ShipRadarDecoy | null {
    const ew = ship.electronicWarfare;
    const srbocHealth = (ship.subsystemHealth.get("srboc") ?? 0) / 100;
    if (!ship.alive || !ew.decoyEnabled || srbocHealth <= 0.05 || ew.decoyRounds <= 0
      || now < ew.nextDecoyAt || ship.position.distanceTo(threatPosition) > ew.decoyDeployRange) return null;

    const awayFromThreat = ship.position.clone().sub(threatPosition).setY(0);
    if (awayFromThreat.lengthSq() < 0.001) awayFromThreat.set(1, 0, 0);
    awayFromThreat.normalize();
    const side = ++this.serial % 2 === 0 ? 1 : -1;
    const lateral = new THREE.Vector3(-awayFromThreat.z, 0, awayFromThreat.x).multiplyScalar(side);
    const decoy: ShipRadarDecoy = {
      id: `${ship.id}:srboc:${this.serial}`,
      sourceShipId: ship.id,
      position: ship.position.clone().add(new THREE.Vector3(0, 8, 0)).addScaledVector(lateral, 3.5),
      velocity: ship.velocity.clone().addScaledVector(lateral, 2.8).add(new THREE.Vector3(0, 1.3, 0)),
      age: 0,
      lifeSeconds: ew.decoyLifeSeconds,
      radarCrossSection: ew.decoyRcs,
      alive: true,
    };
    ew.decoyRounds--;
    ew.nextDecoyAt = now + ew.decoyCooldownSeconds / Math.max(0.2, srbocHealth);
    ew.decoys.push(decoy);
    return decoy;
  }

  reset(ship: ShipCombatantInstance) {
    const definition = ship.definition.electronicWarfare;
    ship.electronicWarfare.ecmEnabled = Boolean(definition);
    ship.electronicWarfare.decoyEnabled = Boolean(definition);
    ship.electronicWarfare.decoyRounds = definition?.decoyRounds ?? 0;
    ship.electronicWarfare.nextDecoyAt = Number.NEGATIVE_INFINITY;
    ship.electronicWarfare.decoys.length = 0;
  }
}
