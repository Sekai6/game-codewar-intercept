import assert from "node:assert/strict";
import { planDamageFlight } from "../dist-test/air/ai/damage-management.js";

const base = (overrides = {}) => ({
  mission: "cap",
  maximumLoadFactor: 7.5,
  structureHealth: 100,
  leftEngineHealth: 100,
  rightEngineHealth: 100,
  radarHealth: 100,
  flightControlHealth: 100,
  weaponSystemHealth: 100,
  alternativeCloseWeaponAvailable: true,
  ...overrides,
});

const healthy = planDamageFlight(base());
assert.equal(healthy.mode, "normal");
assert.equal(healthy.trimYawDeg, 0);
assert.equal(healthy.fuelLeakPerSecond, 0);

const leftEngineDamage = planDamageFlight(base({ leftEngineHealth: 28 }));
assert(leftEngineDamage.trimYawDeg < 0,
  "left-engine loss must command starboard trim against the live right engine");
assert(leftEngineDamage.maximumVerticalCommand < healthy.maximumVerticalCommand);
assert.equal(leftEngineDamage.mode, "degraded");

const controlDamage = planDamageFlight(base({ flightControlHealth: 42 }));
assert(controlDamage.maximumBankDeg < healthy.maximumBankDeg);
assert(controlDamage.maximumLoadFactor < healthy.maximumLoadFactor);

const structuralDamage = planDamageFlight(base({ structureHealth: 48 }));
assert(structuralDamage.fuelLeakPerSecond > 0);
assert.equal(structuralDamage.recommendedOrder, "return");

const radarAbort = planDamageFlight(base({
  radarHealth: 8,
  alternativeCloseWeaponAvailable: false,
}));
assert.equal(radarAbort.mode, "abort");
assert.equal(radarAbort.radarOperational, false);
assert.equal(radarAbort.recommendedOrder, "return");

const radarWithIr = planDamageFlight(base({ radarHealth: 8 }));
assert.notEqual(radarWithIr.mode, "abort");
assert.equal(radarWithIr.recommendedOrder, null);

const uncontrollable = planDamageFlight(base({
  leftEngineHealth: 2,
  rightEngineHealth: 2,
  flightControlHealth: 5,
}));
assert.equal(uncontrollable.mode, "uncontrollable");
assert.equal(uncontrollable.recommendedOrder, null,
  "the standard damage/disposition chain owns loss of control");

console.log(JSON.stringify({
  healthy,
  leftEngineDamage,
  controlDamage,
  structuralDamage,
  radarAbort,
  radarWithIr,
  uncontrollable,
}, null, 2));
