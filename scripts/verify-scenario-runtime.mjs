import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateScenarioDocument } from "../dist-test-scenario/scenario-system/validator.js";
import { importScenarioJson } from "../dist-test-scenario/scenario-system/import-export.js";

const source = await readFile(new URL("../src/scenarios/full-spectrum-blackout/scenario.json", import.meta.url), "utf8");
const document = importScenarioJson(source);
assert.equal(validateScenarioDocument(document, { shipDefinitions: ["long-beach", "ticonderoga", "slava-moskva"] }).valid, true);
assert.deepEqual(document.timeline.filter((event) => event.type === "space-weather-phase").map((event) => event.at), [0, 150, 210, 260, 300, 720, 960]);
assert.deepEqual(document.timeline.filter((event) => event.type === "comms-window").map((event) => [event.at, event.at + event.duration]), [[748, 766], [824, 850], [914, 929]]);

const malformed = [
  null, [], {},
  { schemaVersion: 1, metadata: null, simulation: [], forces: [null], routes: [null], zones: [null], objectives: [null], timeline: [null], guidance: { cues: [null] } },
  { ...document, forces: [{}] },
  { ...document, routes: [{ id: "broken", kind: "transit", points: [null] }] },
];
for (const [index, value] of malformed.entries()) {
  let result;
  assert.doesNotThrow(() => { result = validateScenarioDocument(value); }, `malformed case ${index} must not throw TypeError`);
  assert.equal(result.valid, false, `malformed case ${index} must be rejected`);
}
assert.throws(() => importScenarioJson("{"), SyntaxError);
assert.equal(validateScenarioDocument(document, { shipDefinitions: ["long-beach"] }).valid, false);

console.log("scenario runtime verification passed: validation safety, catalog references and timeline facts");
