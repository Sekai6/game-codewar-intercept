import assert from "node:assert/strict";
import * as THREE from "three";
import { FleetSceneIntegration } from "../dist-test/fleet/scene-integration.js";

function definition(id, electronicWarfare) {
  return {
    id, name: id.toUpperCase(), hullNumber: "TEST", era: "test", role: "escort",
    platform: { maxSpeedKnots: 30, cruiseSpeedKnots: 20, patrolSpeedKnots: 15, accelerationKnotsPerSecond: 1,
      decelerationKnotsPerSecond: 1, turnRateDeg: 3, decisionInterval: 1, standoffRange: 100,
      standoffTolerance: 10, significantHeightMeters: 20, radarRcs: 7000 },
    launcher: { kind: "mk41", displayName: "TEST VLS", compatibleWeapons: ["SM-2MR"], columns: 2,
      sequenceInterval: 1, exhaustClearance: 2, isolationStartsAt: 0.5, maximumIsolationFraction: 0.5,
      loadingPermutation: 1, gridSize: 2 },
    sensors: [], subsystemLabels: {}, subsystemPositions: {}, damageModel: { longitudinalLimit: 1, zones: [] },
    ammo: { rim67: 0, sm2mr: 4, sm2er: 0, ciws: 100, channels: 1, illuminators: 1 },
    electronicWarfare, build: () => new THREE.Group(), hullColor: 0,
  };
}
const ew = { ecmStrength: 0.6, burnThroughRange: 65, decoyRounds: 3, decoyCooldownSeconds: 2,
  decoyDeployRange: 90, decoyRcs: 8, decoyLifeSeconds: 12 };
const scenario = { id: "test-force", label: "TEST", side: "blue", doctrineId: "us-ntu-link11",
  datalinkEra: "ntu-baseline", formation: "screen", ships: [
    { instanceId: "flag", definitionId: "flag", position: [0, 0, 0], heading: 0, station: [0, 0, 0], formationRole: "command", commandRoles: ["otc", "aawc"] },
    { instanceId: "escort", definitionId: "escort", position: [-40, 0, 20], heading: 0, station: [-40, 0, 20], formationRole: "picket", commandRoles: ["asuwc"] },
  ] };
const flagshipModel = new THREE.Group();
const integration = new FleetSceneIntegration({
  scene: new THREE.Scene(), scenario,
  definitions: new Map([["flag", definition("flag", ew)], ["escort", definition("escort", ew)]]),
  flagshipModel,
  flagshipSnapshot: () => ({ position: flagshipModel.position, velocity: new THREE.Vector3(), heading: 0,
    speedKnots: 0, commandedSpeedKnots: 0, hullIntegrity: 100, subsystemHealth: new Map(), magazines: new Map() }),
  applyFlagshipDamage: () => undefined,
});

assert.equal(integration.requestCountermeasure("flag", new THREE.Vector3(20, 0, 0), 0), false,
  "legacy flagship must not be handled twice");
assert.equal(integration.requestCountermeasure("escort", new THREE.Vector3(-20, 0, 20), 0), true);
const snapshot = integration.countermeasures("escort");
assert.ok(snapshot?.ecmEnabled);
assert.equal(snapshot?.decoys.length, 1);
assert.deepEqual(integration.electronicWarfareDiagnostics().map(({ shipId, rounds, activeDecoys }) => ({ shipId, rounds, activeDecoys })),
  [{ shipId: "escort", rounds: 2, activeDecoys: 1 }]);
integration.update(0.5, 0.5);
assert.notEqual(snapshot.decoys[0].position.y, 8, "physical decoy should advance in the fleet frame loop");
integration.dispose();

console.log(JSON.stringify({ targetRouting: true, flagshipNotDuplicated: true, ownedInventory: true, physicalDecoy: true }));
