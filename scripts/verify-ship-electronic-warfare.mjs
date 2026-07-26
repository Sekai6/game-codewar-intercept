import assert from "node:assert/strict";
import * as THREE from "three";
import { createShipCombatant } from "../dist-test/ships/ship-runtime.js";
import { ShipElectronicWarfareRuntime } from "../dist-test/ships/electronic-warfare-runtime.js";

const definition = {
  id: "test-ew-ship",
  name: "EW TEST SHIP",
  platform: { patrolSpeedKnots: 18, radarRcs: 8000 },
  ammo: { rim67: 0, sm2mr: 0, sm2er: 0, ciws: 1200, channels: 2, illuminators: 1 },
  electronicWarfare: {
    ecmStrength: 0.64,
    burnThroughRange: 70,
    decoyRounds: 2,
    decoyCooldownSeconds: 2,
    decoyDeployRange: 90,
    decoyRcs: 8.5,
    decoyLifeSeconds: 10,
  },
  build: () => new THREE.Group(),
};
const ship = createShipCombatant({
  id: "ship-1", forceId: "force-1", side: "blue", definition,
  position: new THREE.Vector3(), heading: 0,
});
const runtime = new ShipElectronicWarfareRuntime();

assert.equal(runtime.snapshot(ship).ecmEnabled, true);
assert.equal(runtime.deploy(ship, new THREE.Vector3(100, 0, 0), 0), null, "out-of-range threats must not trigger SRBOC");
const first = runtime.deploy(ship, new THREE.Vector3(50, 0, 0), 0);
assert.ok(first, "in-range threat should trigger a physical decoy");
assert.equal(ship.electronicWarfare.decoyRounds, 1);
assert.equal(runtime.deploy(ship, new THREE.Vector3(50, 0, 0), 1), null, "cooldown must block a second release");
assert.notDeepEqual(first.position.toArray(), ship.position.toArray(), "decoy must have a physical release point");
const initialPosition = first.position.clone();
runtime.update(ship, 1);
assert.ok(first.position.distanceTo(initialPosition) > 0, "decoy must retain and integrate velocity");
assert.ok(first.radarCrossSection < definition.electronicWarfare.decoyRcs, "decoy RCS must decay");
assert.equal(runtime.snapshot(ship).decoys.length, 1);

ship.subsystemHealth.set("srboc", 0);
assert.equal(runtime.deploy(ship, new THREE.Vector3(50, 0, 0), 3), null, "destroyed launcher must block release");
ship.subsystemHealth.set("ecm", 0);
assert.equal(runtime.snapshot(ship).ecmEnabled, false, "destroyed ECM must stop jamming");
runtime.update(ship, 10);
assert.equal(runtime.snapshot(ship).decoys.length, 0, "expired decoys must leave the seeker contest");
runtime.reset(ship);
assert.equal(ship.electronicWarfare.decoyRounds, 2);
assert.equal(ship.electronicWarfare.decoys.length, 0);

console.log(JSON.stringify({ physicalRelease: true, cooldown: true, damageGating: true, decay: true }));
