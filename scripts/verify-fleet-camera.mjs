import assert from "node:assert/strict";
import { fleetCameraFrame } from "../dist-test/fleet/camera.js";
const observation = { members: [
  { x: 0, y: 0, z: 0 },
  { x: 80, y: 4, z: -40 },
  { x: -40, y: 2, z: 20 },
] };
const frame = fleetCameraFrame(observation);
assert.ok(frame);
assert.ok(frame.radius >= 35);
assert.ok(Math.abs(frame.center.x - 13.3333333) < 1e-5);
assert.ok(Math.abs(frame.center.z + 6.6666667) < 1e-5);
assert.equal(fleetCameraFrame({ members: [] }), undefined);
console.log(JSON.stringify({ radius: Number(frame.radius.toFixed(2)), center: frame.center.toArray() }));
