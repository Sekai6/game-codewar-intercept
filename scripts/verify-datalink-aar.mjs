import { DatalinkAarRecorder } from "../dist-test/aar/datalink-recorder.js";
import { exportTacviewAcmi } from "../dist-test/aar/acmi-exporter.js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const position = (x, y, z) => ({ x, y, z });
const activity = { id: "l11-poll-1", network: "link11", kind: "poll", time: 2, senderId: "cg-57", recipientId: "f-14-1" };
const observation = {
  era: "ntu-baseline", enabled: true,
  nodes: [{ id: "cg-57", network: "link11", position: position(0, 0, 0), terminalHealth: 93, transmitEnabled: true, receiveEnabled: true, role: "ncs" }],
  tracks: [{ id: "red-air-1", network: "link11", position: position(40, 18, -60), uncertainty: 3600, quality: .58, age: 3.5, classification: "aircraft", senderId: "cg-57" }],
  activities: [activity],
  decisions: [{ id: "cue-use-1", network: "link11", kind: "cue-accepted-search", time: 2.1, participantId: "cg-57", trackId: "red-air-1" }],
  link11: { queued: 0, transmitted: 1, delivered: 0, droppedCapacity: 0, droppedLink: 0, droppedDuplicate: 0, meanDelay: .8, rollCalls: 1, netControlStation: "cg-57", cycleSeconds: 6 },
  link16: { queued: 0, transmitted: 0, delivered: 0, droppedCapacity: 0, droppedLink: 0, droppedDuplicate: 0, meanDelay: 0 },
};
const recorder = new DatalinkAarRecorder();
const first = recorder.sample(observation, 2);
const repeated = recorder.sample(observation, 2.25);
assert(first.events.some(event => event.text.includes("LINK11 POLL")), "Link 11 poll was not recorded");
assert(first.events.some(event => event.text.includes("CUE ACCEPTED FOR SEARCH")), "cue use was not recorded");
assert(repeated.events.length === 0, "repeated network activity was not deduplicated");
assert(first.snapshot.tracks[0].uncertainty === 3600, "track uncertainty was not preserved");

const base = { ship: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, speed: 0, verticalSpeed: 0, hull: 100 }, missiles: [], interceptors: [], chaff: [], enemyPlatform: null, surfaceStrikes: [], aircraft: [], airWeapons: [], airDecoys: [] };
const acmi = exportTacviewAcmi([
  { ...base, time: 2, datalink: first.snapshot },
  { ...base, time: 2.25, datalink: { ...first.snapshot, tracks: [] } },
], first.events, { title: "Datalink AAR", referenceTime: new Date("1986-01-01T00:00:00Z"), blueShipName: "USS Lake Champlain" });
assert(acmi.includes("0,DataLink=ntu-baseline"), "mission data-link metadata missing");
assert(acmi.includes("Type=Misc+Bullseye,Name=LINK11 EST red-air-1,Coalition=Neutral"), "estimated track reference object missing");
assert(acmi.includes("EngagementQuality=Cue"), "cue-only semantics missing");
assert(acmi.includes("Uncertainty=3600.0"), "track uncertainty property missing");
assert(!acmi.includes("Type=Weapon+Missile,Name=LINK11"), "radio traffic was emitted as a weapon");
const estimateId = acmi.split("\n").find(line => line.includes("Name=LINK11 EST red-air-1"))?.split(",")[0];
assert(estimateId && acmi.includes(`-${estimateId}`), "expired estimated track was not deleted");
assert(acmi.split("LINK11 POLL").length === 2, "network event was duplicated in ACMI");
console.log(JSON.stringify({ events: first.events.length, estimateId, bytes: acmi.length }, null, 2));
