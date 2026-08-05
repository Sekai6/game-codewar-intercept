import assert from "node:assert/strict";
import * as THREE from "three";
import { ConflictTrackFusionRuntime } from "../dist-test/tracks/conflict-fusion.js";

const track = (targetId, x) => ({
  targetId,
  position:new THREE.Vector3(x, 0, 0),
  velocity:new THREE.Vector3(),
  quality:.8,
  uncertainty:1000,
  classification:"aircraft",
  source:"radar",
  updatedAt:0,
  weaponQuality:false,
});
const reports = (separation) => [
  { track:track("red-one", 0), contributor:"ship-a:radar" },
  { track:track("red-two", separation), contributor:"ship-b:radar" },
];

const fusion = new ConflictTrackFusionRuntime();
fusion.fuse(reports(25), 0);
assert.deepEqual(fusion.drainEvents().map((event) => event.kind), ["conflict-detected"]);
for (let now=.05; now<8; now+=.05) fusion.fuse(reports(25.5), now);
assert.equal(fusion.drainEvents().length, 0, "stable conflict must not emit every simulation tick");
fusion.fuse(reports(32), 8.05);
assert.equal(fusion.drainEvents().length, 0, "small absolute jitter must remain suppressed after the interval");
fusion.fuse(reports(45), 8.10);
assert.deepEqual(fusion.drainEvents().map((event) => event.kind), ["conflict-updated"], "material separation changes report after the minimum interval");
for (let now=8.15; now<32.10; now+=.05) fusion.fuse(reports(45.5), now);
assert.equal(fusion.drainEvents().length, 0, "stable conflicts only emit a long-period heartbeat");
fusion.fuse(reports(45.5), 32.15);
assert.deepEqual(fusion.drainEvents().map((event) => event.kind), ["conflict-updated"]);
fusion.fuse(reports(5), 32.20);
fusion.fuse(reports(5), 32.25);
fusion.fuse(reports(5), 32.30);
assert.deepEqual(fusion.drainEvents().map((event) => event.kind), ["conflict-resolved"], "resolution must never be throttled");
for (let now=32.35; now<47.25; now+=.05) fusion.fuse(reports(10.5), now);
assert.equal(fusion.drainEvents().length, 0, "recently resolved tracks must not chatter across the association gate");
fusion.fuse(reports(25), 47.35);
assert.deepEqual(fusion.drainEvents().map((event) => event.kind), ["conflict-detected"], "a materially divergent track must reopen after hysteresis");

const sameIdentity = new ConflictTrackFusionRuntime();
sameIdentity.fuse([
  { track:track("red-one", 0), contributor:"ship-a:radar" },
  { track:track("red-one", 25), contributor:"ship-b:radar" },
], 0);
assert.equal(sameIdentity.drainEvents()[0]?.trackId, "red-one", "same-identity disagreement must not produce a duplicated id label");

console.log("track conflict fusion throttling verification passed");
