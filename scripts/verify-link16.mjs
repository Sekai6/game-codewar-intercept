import assert from "node:assert/strict";
import * as THREE from "three";
import { Link16Network } from "../dist-test/datalink/link16-network.js";
import { trackSupportsWeaponAuthorization } from "../dist-test/air/ooda.js";

const participant = (id, side, x = 0) => ({
  id,
  side,
  position: new THREE.Vector3(x, 20, 0),
  alive: true,
  terminalHealth: 1,
  timeSyncQuality: 1,
  transmitEnabled: true,
  receiveEnabled: true,
});
const report = (observationId, trackId = "hostile-1", priority = "routine") => ({
  trackId: `track-${trackId}`,
  originSensorId: "blue-1:radar",
  observationId,
  relayChain: [],
  observedAt: 0,
  position: new THREE.Vector3(100, 30, 0),
  velocity: new THREE.Vector3(2, 0, 0),
  classification: "aircraft",
  quality: 0.7,
  uncertainty: 4,
  priority,
});

const network = new Link16Network({ slotsPerFrame: 2, maximumRange: 500 });
network.upsertParticipant(participant("blue-1", "blue"));
network.upsertParticipant(participant("blue-2", "blue", 40));
network.upsertParticipant(participant("red-1", "red", 40));
network.upsertParticipant(participant("blue-far", "blue", 800));
assert.equal(network.publishTrack("blue-1", report("obs-1"), 0), true);
network.update(0);
assert.equal(network.drainInbox("blue-2").length, 0, "delivery must not be instantaneous");
network.update(1);
const received = network.drainInbox("blue-2");
assert.equal(received.length, 1, "friendly participant should receive the report");
assert.ok(received[0].networkDelay >= 0.18, "TDMA report must carry latency");
assert.equal(network.drainInbox("red-1").length, 0, "opposing coalition must be isolated");
assert.equal(network.drainInbox("blue-far").length, 0, "out-of-range terminal must not receive");
assert.notEqual(received[0].report.position, report("copy-check").position, "reports must be copied");

network.publishTrack("blue-1", report("obs-1"), 1.1);
network.update(2.1);
network.update(3.1);
assert.equal(network.drainInbox("blue-2").length, 0, "duplicate observation must be rejected");

const cueTrack = { ...report("cue"), lastUpdate: 0, source: "link16", engagementQuality: "cue" };
const localTrack = { ...cueTrack, source: "local-radar", engagementQuality: "weapon" };
assert.equal(trackSupportsWeaponAuthorization(cueTrack), false);
assert.equal(trackSupportsWeaponAuthorization(localTrack), true);

const diagnostics = network.diagnostics();
assert.ok(diagnostics.transmitted >= 2);
assert.ok(diagnostics.delivered >= 1);
assert.ok(diagnostics.droppedDuplicate >= 1);
assert.ok(diagnostics.droppedLink >= 1);

const priorityNetwork = new Link16Network({ slotsPerFrame: 1, maximumRange: 500 });
priorityNetwork.upsertParticipant(participant("blue-1", "blue"));
priorityNetwork.upsertParticipant(participant("blue-2", "blue", 20));
priorityNetwork.publishTrack("blue-1", report("routine", "routine-target"), 0);
priorityNetwork.publishTrack("blue-1", report("emergency", "urgent-target", "emergency"), 0);
priorityNetwork.update(0);
priorityNetwork.update(1);
assert.equal(
  priorityNetwork.drainInbox("blue-2")[0]?.report.trackId,
  "track-urgent-target",
  "emergency reports must win the next TDMA slot",
);
console.log(JSON.stringify({ received: received.length, diagnostics }, null, 2));
