import assert from "node:assert/strict";
import { FleetAarRecorder } from "../dist-test/aar/fleet-recorder.js";
import { exportTacviewAcmi } from "../dist-test/aar/acmi-exporter.js";

const member = (id, roles = []) => ({
  id, name: id === "blue-cg-57" ? "USS Lake Champlain" : "USS Long Beach", hullNumber: id === "blue-cg-57" ? "CG-57" : "CGN-9", side: "blue",
  x: id === "blue-cg-57" ? 12 : 0, y: 0, z: 0, heading: 0, speedKnots: 18, hull: 100, alive: true,
  formationRole: id === "blue-cg-57" ? "screen" : "otc", commandRoles: roles, stationStatus: "on-station", stationError: 2,
  magazines: { rim67: 0, sm2mr: 8, sm2er: 4 }, localTracks: 1, networkTracks: 1,
  fireIntensity: 0, flooding: 0, damagedSubsystems: 0, failedSubsystems: 0,
});
const observation = (assignment) => ({
  id: "blue-ntu", enabled: true, datalinkEra: "ntu", link11Enabled: true, formation: "screen",
  members: [member("blue-cgn-9", ["otc", "aawc"]), member("blue-cg-57")],
  tracks: [{ id: "M-104", classification: "missile", quality: .8, uncertainty: 120, age: 1, contributors: ["blue-cgn-9:organic-radar", "blue-cg-57:link11"], weaponAuthority: false }],
  assignments: assignment ? [assignment] : [], engagements: [], networkActivities: [],
  physicalLaunches: [{ shipId: "blue-cg-57", launcherLabel: "MK 41 FWD", launchPoint: "CELL 26", weapon: "SM-2ER", time: 2 }],
});
const recorder = new FleetAarRecorder();
const base = { id: "AAW-1", targetId: "M-104", shooterId: "blue-cg-57", localTrackId: "M-104", weapon: "SM-2MR", requestedShots: 2, weaponsAway: 0, status: "accepted", updatedAt: 1 };
let sample = recorder.sample(observation(base), 1);
assert.equal(sample.events.filter((event) => event.text.includes("AAWC ASSIGN")).length, 1);
assert.ok(sample.events.some((event) => event.text.includes("PHYSICAL LAUNCH / blue-cg-57 / MK 41 FWD / CELL 26 / SM-2ER / ORGANIC VLS")));
sample = recorder.sample(observation({ ...base, updatedAt: 2 }), 2);
assert.equal(sample.events.filter((event) => event.text.includes("AAWC ASSIGN")).length, 0);
sample = recorder.sample(observation({ ...base, weaponsAway: 1, updatedAt: 3 }), 3);
assert.equal(sample.events.filter((event) => event.text.includes("WEAPONS AWAY")).length, 1);
sample = recorder.sample(observation({ ...base, weaponsAway: 1, status: "rejected", rejectionReason: "NO_LOCAL_TRACK", updatedAt: 4 }), 4);
assert.ok(sample.events.some((event) => event.text.includes("NO_LOCAL_TRACK")));
assert.deepEqual(sample.snapshot.tracks[0].contributors, ["blue-cgn-9:organic-radar", "blue-cg-57:link11"]);
const damaged = observation(null);
damaged.members[1].fireIntensity = 35;
damaged.members[1].flooding = 22;
damaged.members[1].damagedSubsystems = 2;
sample = recorder.sample(damaged, 5);
assert.ok(sample.events.some((event) => event.text.includes("SHIP DAMAGE / blue-cg-57")));

const snapshot = {
  time: 0, ship: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, speed: 0, verticalSpeed: 0, hull: 100 },
  missiles: [], interceptors: [{ id: 1, x: 12, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, speed: 1, verticalSpeed: 0, weapon: "SM-2MR", targetId: "M-104", shooterId: "blue-cg-57" }],
  chaff: [], enemyPlatform: null, surfaceStrikes: [], aircraft: [], airWeapons: [], airDecoys: [],
  fleet: sample.snapshot,
};
const acmi = exportTacviewAcmi([snapshot], [], { title: "fleet", referenceTime: new Date("2026-01-01T00:00:00Z"), blueShipName: "USS Long Beach" });
assert.match(acmi, /USS Long Beach CGN-9/);
assert.match(acmi, /USS Lake Champlain CG-57/);
assert.match(acmi, /Parent=101\n/);
assert.equal((acmi.match(/USS Long Beach CGN-9/g) ?? []).length, 1);
console.log(JSON.stringify({ events: sample.events.length, independentShips: 2, parent: "blue-cg-57", contributors: sample.snapshot.tracks[0].contributors }));
