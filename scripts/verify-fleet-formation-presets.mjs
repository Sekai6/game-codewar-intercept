import assert from "node:assert/strict";
import {
  FLEET_FORMATION_OPTIONS,
  defaultFormationStation,
  parseFleetFormation,
} from "../dist-test/fleet/formation-presets.js";

if (FLEET_FORMATION_OPTIONS.length !== 4) throw new Error("Expected four selectable formations");
if (parseFleetFormation("column") !== "column") throw new Error("Known formation was not parsed");
if (parseFleetFormation("invalid") !== "screen") throw new Error("Invalid formation must fall back to screen");
const expected = {
  screen: [ -85, 0, 55 ],
  "line-abreast": [ -95, 0, 0 ],
  column: [ 0, 0, 95 ],
  dispersed: [ -130, 0, 105 ],
};
for (const [formation, station] of Object.entries(expected)) {
  assert.deepEqual(defaultFormationStation(formation, 1, "picket"), station);
  assert.deepEqual(defaultFormationStation(formation, 0, "command"), [0, 0, 0]);
}
console.log(JSON.stringify({ formations: Object.keys(expected), commandAnchored: true }));
