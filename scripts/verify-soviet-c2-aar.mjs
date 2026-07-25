import { SovietC2AarRecorder } from "../dist-test/aar/soviet-c2-recorder.js";
import { exportTacviewAcmi } from "../dist-test/aar/acmi-exporter.js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const position = (x, y, z) => ({ x, y, z });
const observation = {
  era: "ntu-1980s", enabled: true,
  nodes: [{ id: "fleet-post", kind: "fleet-command", label: "FLEET COMMAND POST", position: position(420, 14, -940), operational: true }],
  gciCommands: [{ id: "GCI-CMD-1", participantId: "red-MIG-29A-1", participantPosition: position(50, 60, -400), controllerTrackId: "GCI-a019", interceptPoint: position(-30, 72, -120), quality: .63, uncertainty: 22, deliveredAt: 4, expiresAt: 18 }],
  maritimeAreas: [{ id: "MARITIME-CUE-1", participantId: "red-TU-16K-1", reportTrackId: "RORSAT-200871f0", source: "legenda", estimatedPosition: position(24, 0, 42), launchRegionCenter: position(45, 90, -377), uncertaintyMajor: 58, uncertaintyMinor: 32, uncertaintyBearing: 1.2, quality: .67, deliveredAt: 7.6, expiresAt: 60 }],
  fleetOrders: [{ id: "FLEET-ORDER-1", participantId: "red-TU-16K-1", participantPosition: position(70, 88, -250), commandNodeId: "fleet-post", sourceReportTrackId: "RORSAT-200871f0", approachPoint: position(50, 88, -120), attackWindowStart: 14.9, attackWindowEnd: 27.9, deliveredAt: 10.9, expiresAt: 40 }],
  salvoAssignments: [{ id: "SOVIET-SALVO-1-1", waveId: "SOVIET-SALVO-1", participantId: "red-TU-16K-1", participantPosition: position(70, 88, -250), sourceOrderId: "FLEET-ORDER-1", sourceReportTrackId: "RORSAT-200871f0", sequence: 1, total: 2, releaseAt: 17.2, plannedArrivalAt: 45.3, expiresAt: 31 }],
  events: [],
};
const recorder = new SovietC2AarRecorder();
const first = recorder.sample(observation, 11);
const repeated = recorder.sample(observation, 11.25);
assert(first.events.some(event => event.text.includes("STRATEGIC TARGET-AREA CUE")), "strategic cue event missing");
assert(first.events.some(event => event.text.includes("FLEET MISSION ORDER")), "fleet-order event missing");
assert(first.events.some(event => event.text.includes("SALVO RELEASE PLAN")), "salvo-plan event missing");
assert(first.events.every(event => event.category === "network"), "Soviet C2 event category is not network");
assert(repeated.events.length === 0, "Soviet C2 events were not deduplicated");

const base = { ship: { x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,verticalSpeed:0,hull:100 }, missiles:[], interceptors:[], chaff:[], enemyPlatform:null, surfaceStrikes:[], aircraft:[], airWeapons:[], airDecoys:[] };
const acmi = exportTacviewAcmi([{ ...base, time: 11, sovietC2: first.snapshot }], first.events,
  { title: "Soviet C2 AAR", referenceTime: new Date("1986-01-01T00:00:00Z"), blueShipName: "USS Lake Champlain" });
assert(acmi.includes("0,SovietCommandEra=ntu-1980s"), "Soviet era metadata missing");
assert(acmi.includes("C2Layer=MaritimeTargetIndication"), "maritime target-area object missing");
assert(acmi.includes("C2Layer=FleetCommand"), "fleet-order object missing");
assert(acmi.includes("C2Layer=SalvoCoordination"), "salvo object missing");
assert(acmi.includes("WeaponAuthority=No") && acmi.includes("WeaponAuthority=OrganicTrackRequired"), "weapon-authority boundaries missing");
assert(!acmi.includes("blue-surface-ship"), "Soviet C2 ACMI leaked target truth identity");
console.log(JSON.stringify({ events: first.events.length, nodes: first.snapshot.nodes.length, areas: first.snapshot.maritimeAreas.length, orders: first.snapshot.fleetOrders.length, salvos: first.snapshot.salvoAssignments.length, bytes: acmi.length }, null, 2));
