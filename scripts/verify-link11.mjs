import assert from "node:assert/strict";
import * as THREE from "three";
import { Link11Network } from "../dist-test/datalink/link11-network.js";

const network = new Link11Network();
const participant = (id, x, netControlCapable = false) => ({ id, side: "blue",
  position: new THREE.Vector3(x, 0, 0), alive: true, terminalHealth: .94,
  timeSyncQuality: .7, transmitEnabled: true, receiveEnabled: true, netControlCapable });
network.upsertParticipant(participant("blue-ncs", 0, true));
network.upsertParticipant(participant("blue-picket", 200));
network.upsertParticipant({ ...participant("red-listener", 100, true), side: "red" });
assert.equal(network.publishTrack("blue-picket", { trackId: "TN-101",
  originSensorId: "picket-radar", observationId: "obs-1", relayChain: [], observedAt: 0,
  position: new THREE.Vector3(300, 20, 0), velocity: new THREE.Vector3(-2, 0, 0),
  classification: "aircraft", quality: .8, uncertainty: 1, priority: "emergency" }, 0), true);
for (let time = 0; time <= 12; time += .25) network.update(time);
const blue = network.drainInbox("blue-ncs"), red = network.drainInbox("red-listener"),
  diagnostics = network.diagnostics();
assert.equal(blue.length, 1);
assert.equal(red.length, 0, "Link 11 must preserve coalition isolation");
assert.ok(blue[0].networkDelay >= 3, "roll-call delay must be materially slower than Link 16");
assert.ok(blue[0].report.quality < .8 && blue[0].report.uncertainty > 3000);
assert.equal(diagnostics.netControlStation, "blue-ncs");
assert.equal(diagnostics.cycleSeconds, 6);
assert.ok(diagnostics.rollCalls >= 5);
console.log(JSON.stringify(diagnostics, null, 2));
