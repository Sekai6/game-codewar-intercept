import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { compileScenario } from "../dist-test-scenario/scenario-system/compiler.js";

const document = JSON.parse(await readFile(new URL("../src/scenarios/full-spectrum-blackout/scenario.json", import.meta.url), "utf8"));
const runtime = compileScenario(document).weatherFronts;
const at0 = runtime.snapshotsAt(0)[0];
const at300 = runtime.snapshotsAt(300)[0];
assert.ok(at0 && at300, "weather front must compile");
assert.ok(at0.center.distanceTo(at300.center) > 10, "weather front must move deterministically");
assert.deepEqual(runtime.snapshotsAt(300)[0].center.toArray(), at300.center.toArray(), "same seed/time must repeat");
const inside = runtime.effectAt(at300.center.clone().setY(22), 300);
const outside = runtime.effectAt(new THREE.Vector3(5000, 22, 5000), 300);
assert.ok(inside.intensity > .8 && inside.radarRangeFactor < .85 && inside.measurementNoiseFactor > 1.8);
assert.equal(outside.intensity, 0);
assert.equal(outside.radarRangeFactor, 1);
process.stdout.write(JSON.stringify({ moved:at0.center.distanceTo(at300.center), inside, outside }, null, 2));
