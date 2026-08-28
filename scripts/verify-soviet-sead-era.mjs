import assert from "node:assert/strict";
import fs from "node:fs";
import { validateScenarioDocument } from "../dist-test-scenario/scenario-system/validator.js";

const base = JSON.parse(fs.readFileSync(new URL("../scenarios/full-spectrum-blackout/scenario.json", import.meta.url), "utf8"));
base.forces.push({ kind:"air-formation", id:"soviet-sead-test", platformId:"MIG-29A-SEAD", side:"red", forceId:"red-air", position:[0,80,-1200], headingDeg:180, count:2, altitude:80, speed:5, mission:"sead", loadout:{"Kh-31P-C":1} });
for (const era of ["early-cold-war", "ocean-navy", "ntu-1980s"]) {
  const candidate = structuredClone(base); candidate.simulation.sovietCommandEra = era;
  assert.equal(validateScenarioDocument(candidate).valid, false, `${era} must reject Soviet SEAD`);
}
const late = structuredClone(base); late.simulation.sovietCommandEra = "late-soviet";
assert.equal(validateScenarioDocument(late).valid, true);
console.log("Soviet SEAD era gating verification passed");
