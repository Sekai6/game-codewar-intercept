import { strict as assert } from "node:assert";
import {
  initialMissionPlannerState,
  planAirMission,
} from "../dist-test/air/ai/mission-planner.js";

const position = { x: 200, y: 60, z: -400 };
const base = (mission, overrides = {}) => ({
  time: 40,
  state: initialMissionPlannerState({ mission, position: { x: 0, y: 60, z: 0 } }),
  currentOrder: mission,
  position,
  heading: { x: 0, y: 0, z: -1 },
  fuelRemaining: 800,
  fuelLeakPerSecond: 0,
  nominalFuel: 900,
  cruiseSpeed: 5,
  engineHealth: 1,
  flightControlHealth: 1,
  radarHealth: 1,
  weaponSystemHealth: 1,
  weaponsRemaining: 4,
  hasAirborneWeapon: false,
  hasEngaged: false,
  contactLostSeconds: 0,
  contacts: [],
  protectedAssetAlive: true,
  escortAvailable: true,
  ...overrides,
});

const commit = planAirMission(base("cap", {
  contacts: [{ position: { x: 250, y: 60, z: -500 }, quality: 0.6,
    classification: "aircraft" }],
}));
assert.equal(commit.state.phase, "commit");

const bingo = planAirMission(base("cap", { fuelRemaining: 150 }));
assert.equal(bingo.order, "return");
assert.equal(bingo.state.reason, "fuel-reserve");

const strikeComplete = planAirMission(base("anti-ship", {
  weaponsRemaining: 0,
}));
assert.equal(strikeComplete.order, "egress");

const escortLoss = planAirMission(base("escort", {
  protectedAssetAlive: false,
}));
assert.equal(escortLoss.order, "return");

const aewRetreat = planAirMission(base("aew", {
  escortAvailable: false,
  contacts: [{ position: { x: 220, y: 60, z: -420 }, quality: 0.7,
    classification: "aircraft" }],
}));
assert.equal(aewRetreat.state.phase, "retreat");
assert.equal(aewRetreat.order, "aew");
assert.ok(aewRetreat.navigationPoint);
assert.ok(Math.hypot(
  aewRetreat.navigationPoint[0] - 220,
  aewRetreat.navigationPoint[2] + 420,
) > Math.hypot(position.x - 220, position.z + 420));

const radarFailure = planAirMission(base("aew", { radarHealth: 0.3 }));
assert.equal(radarFailure.order, "return");
assert.equal(radarFailure.state.reason, "mission-system-damage");

const externalAbort = planAirMission(base("cap", { currentOrder: "return" }));
assert.equal(externalAbort.order, "return");
assert.equal(externalAbort.state.reason, "external-return");

console.log(JSON.stringify({
  commit: commit.state.phase,
  bingo: bingo.state.reason,
  strike: strikeComplete.state.phase,
  escort: escortLoss.state.reason,
  aew: aewRetreat.state.phase,
  radarFailure: radarFailure.state.reason,
  externalAbort: externalAbort.state.reason,
}, null, 2));
