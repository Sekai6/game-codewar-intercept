import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const path = new URL("../src/scenarios/full-spectrum-blackout/scenario.json", import.meta.url);
const source = await readFile(path, "utf8");
const scenario = JSON.parse(source);

assert.equal(scenario.schemaVersion, 1);
assert.equal(scenario.id, "full-spectrum-blackout");
assert.equal(scenario.simulation.durationSeconds, 1080);
assert.equal(scenario.simulation.datalinkEra, "ntu-baseline");
assert.equal(scenario.environment.spaceWeatherPresetId, "TOTAL_BAND_DENIAL");

const entityIds = new Set();
for (const force of scenario.forces) {
  assert(!entityIds.has(force.id), `duplicate force id: ${force.id}`);
  entityIds.add(force.id);
  assert.equal(force.position.length, 3);
  assert(force.position.every(Number.isFinite));
  assert(Number.isFinite(force.headingDeg));
}
assert.equal(scenario.forces.filter((force) => force.kind === "ship").length, 3);
const airFormations = scenario.forces.filter((force) => force.kind === "air-formation");
const aircraftCount = (side, platformId) => airFormations
  .filter((force) => force.side === side && force.platformId === platformId)
  .reduce((sum, force) => sum + force.count, 0);
assert.equal(airFormations.reduce((sum, force) => sum + force.count, 0), 16);
assert.equal(airFormations.filter((force) => force.side === "blue").reduce((sum, force) => sum + force.count, 0), 5);
assert.equal(airFormations.filter((force) => force.side === "red").reduce((sum, force) => sum + force.count, 0), 11);
assert.equal(aircraftCount("red", "TU-16K"), 6);
assert.equal(aircraftCount("red", "MIG-29A"), 4);

const routeIds = new Set(scenario.routes.map((route) => route.id));
for (const force of scenario.forces) if (force.routeId) assert(routeIds.has(force.routeId), `unknown route: ${force.routeId}`);
for (const objective of scenario.objectives) for (const targetId of objective.targetIds) assert(entityIds.has(targetId), `unknown objective target: ${targetId}`);

const phases = scenario.timeline.filter((event) => event.type === "space-weather-phase");
assert.deepEqual(phases.map((event) => event.value), ["quiet", "warning", "solar-flare", "degrading", "total-blackout", "intermittent", "recovery"]);
assert(phases.every((event, index) => index === 0 || event.at > phases[index - 1].at));
assert.deepEqual(scenario.guidance.estimatedContactWindow, [180, 420]);
assert(scenario.guidance.cues.some((cue) => cue.trigger.type === "inactivity"));
assert(scenario.guidance.cues.some((cue) => cue.trigger.type === "space-weather-phase" && cue.trigger.phase === "total-blackout"));

const normalized = structuredClone(scenario);
normalized.metadata.tags.sort();
normalized.forces.sort((a, b) => a.id.localeCompare(b.id));
normalized.routes.sort((a, b) => a.id.localeCompare(b.id));
normalized.zones.sort((a, b) => a.id.localeCompare(b.id));
normalized.objectives.sort((a, b) => a.id.localeCompare(b.id));
normalized.guidance.cues.sort((a, b) => a.id.localeCompare(b.id));
normalized.timeline.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
assert.deepEqual(JSON.parse(JSON.stringify(normalized)), normalized, "scenario must remain pure JSON through round-trip");

console.log(`scenario-system verification passed: ${scenario.forces.length} formations/entities, 16 aircraft (6 Tu-16K + 4 MiG-29A), ${scenario.guidance.cues.length} guidance cues`);
