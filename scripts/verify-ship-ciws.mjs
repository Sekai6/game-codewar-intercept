import assert from "node:assert/strict";
import * as THREE from "three";
import { createShipCombatant } from "../dist-test/ships/ship-runtime.js";
import { ShipCiwsRuntime } from "../dist-test/ships/ciws-runtime.js";

const model = new THREE.Group();
const mount = new THREE.Group();
mount.name = "ciwsFore";
model.add(mount);
const definition = {
  id: "ciws-test", name: "CIWS TEST", platform: { patrolSpeedKnots: 0, radarRcs: 5000 },
  ammo: { rim67: 0, sm2mr: 0, sm2er: 0, ciws: 120, channels: 0, illuminators: 0 },
  ciws: { mounts: [{ objectName: "ciwsFore", label: "FORE", centerBearingDeg: 90, arcDeg: 120 }],
    maximumRange: 15, minimumClosingSpeed: 0.5, minimumTti: 0.35, burstRounds: 60,
    cooldownSeconds: 0.55, traverseRateDeg: 70, firingToleranceDeg: 12,
    basePk: 1, maximumPk: 1, damage: 42 },
  build: () => model,
};
const ship = createShipCombatant({ id: "ship", forceId: "force", side: "blue", definition,
  position: new THREE.Vector3(), heading: 0 });
const targetPosition = new THREE.Vector3(10, 0, 0);
const targetEntity = { id: "asm", side: "red", kind: "missile", position: targetPosition,
  velocity: new THREE.Vector3(-2, 0, 0), radarCrossSection: 0.1, infraredSignature: 1, alive: true,
  applyDamage() { this.alive = false; } };
const target = { mesh: new THREE.Group(), velocity: targetEntity.velocity, phase: "terminal",
  threatType: "RGM-84 Harpoon", rcs: 0.1, entity: targetEntity };
target.mesh.position.copy(targetPosition);
ship.localTracks.set("asm", { targetId: "asm", position: targetPosition.clone(), velocity: targetEntity.velocity.clone(),
  quality: 1, uncertainty: 0, classification: "missile", source: "local-radar", updatedAt: 0, weaponQuality: true });
const runtime = new ShipCiwsRuntime();
let tracers = 0;
runtime.update(ship, 0, 0.05, { resolveTarget: () => target, resolveHit: (resolved, damage) => {
  resolved.entity.applyDamage(damage, resolved.mesh.position); return !resolved.entity.alive;
}, createTracer: () => tracers++ });
assert.equal(targetEntity.alive, false, "CIWS hit must settle through the target entity");
assert.equal(ship.magazines.ciws, 60, "burst must consume only the firing ship's rounds");
assert.equal(tracers, 1, "physical mount must emit one tracer burst");
assert.equal(runtime.diagnostics()[0].result, "kill");

targetEntity.alive = true;
target.phase = "terminal";
runtime.update(ship, 0.2, 0.05, { resolveTarget: () => target, resolveHit: () => true });
assert.equal(ship.magazines.ciws, 60, "cooldown must prevent immediate repeat fire");
ship.localTracks.clear();
runtime.update(ship, 1, 0.05, { resolveTarget: () => target, resolveHit: () => true });
assert.equal(ship.magazines.ciws, 60, "truth target without an organic track must not authorize CIWS");
ship.subsystemHealth.set("ciws", 0);
ship.localTracks.set("asm", { targetId: "asm", position: targetPosition.clone(), velocity: targetEntity.velocity.clone(),
  quality: 1, uncertainty: 0, classification: "missile", source: "local-radar", updatedAt: 1, weaponQuality: true });
runtime.update(ship, 1, 0.05, { resolveTarget: () => target, resolveHit: () => true });
assert.equal(ship.magazines.ciws, 60, "destroyed CIWS must not fire");

console.log(JSON.stringify({ organicTrackRequired: true, physicalMount: true, ownedAmmo: true, cooldown: true, damageGate: true }));
