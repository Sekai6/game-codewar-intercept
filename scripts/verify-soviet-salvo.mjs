import * as THREE from "three";
import { SovietSalvoCoordinator } from "../dist-test/soviet-c2/salvo-coordination.js";

const coordinator = new SovietSalvoCoordinator();
const order = {
  id: "FLEET-ORDER-7",
  participantId: "red-TU-16K-1",
  commandNodeId: "soviet-fleet-command-post",
  sourceReportTrackId: "RORSAT-8a31f420",
  mission: "maritime-strike",
  priority: "main-effort",
  approachPoint: new THREE.Vector3(20, 80, -300),
  egressDirection: new THREE.Vector3(0, 0, -1),
  attackWindowStart: 20,
  attackWindowEnd: 34,
  issuedAt: 8,
  deliveredAt: 12,
  expiresAt: 42,
};
const participants = [
  { id: "red-TU-16K-1", formationId: "badger-1", position: new THREE.Vector3(-12, 82, -415), alive: true, weaponReady: true },
  { id: "red-TU-16K-2", formationId: "badger-1", position: new THREE.Vector3(12, 80, -420), alive: true, weaponReady: true },
];
const targetArea = {
  reportTrackId: order.sourceReportTrackId,
  estimatedPosition: new THREE.Vector3(0, 0, 0),
};

coordinator.update({ time: 13, order: undefined, participants, targetArea, weaponSpeed: 24 });
if (coordinator.diagnostics(13).assignments !== 0)
  throw new Error("Salvo planner created assignments without a fleet order");

coordinator.update({ time: 13, order, participants, targetArea, weaponSpeed: 24 });
const plans = participants.map((participant) => coordinator.planFor(participant.id, 13));
if (plans.some((plan) => !plan)) throw new Error("A live, armed formation member was not assigned");
if (plans.some((plan) => plan.releaseAt < order.attackWindowStart || plan.releaseAt >= order.attackWindowEnd))
  throw new Error("Salvo release time fell outside the fleet-command window");
if (Math.max(...plans.map((plan) => plan.plannedArrivalAt)) - Math.min(...plans.map((plan) => plan.plannedArrivalAt)) > 0.01)
  throw new Error("Coordinated wave does not have a common planned arrival");
if (plans.some((plan) => "targetId" in plan || plan.sourceReportTrackId.includes("blue-surface-ship")))
  throw new Error("Salvo assignment leaked target identity or truth-track semantics");
if (plans.some((plan) => plan.searchPoint.distanceTo(targetArea.estimatedPosition) > 1e-9))
  throw new Error("Salvo search direction did not preserve the uncertain report estimate");
if (new Set(plans.map((plan) => plan.waveId)).size !== 1 || plans.some((plan) => plan.total !== 2))
  throw new Error("Formation members were not assigned to one two-round wave");

const unavailable = [{ ...participants[0], alive: false }, { ...participants[1], weaponReady: false }];
coordinator.update({ time: 14, order, participants: unavailable, targetArea, weaponSpeed: 24 });
if (unavailable.some((participant) => coordinator.planFor(participant.id, 14)))
  throw new Error("Dead or unarmed participant retained a release assignment");

console.log(JSON.stringify({ plans, diagnostics: coordinator.diagnostics(14) }, null, 2));
