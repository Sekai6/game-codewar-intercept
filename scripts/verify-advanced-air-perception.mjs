import * as THREE from "three";
import {
  initialPilotPerception,
  updatePilotPerception,
} from "../dist-test/air/ai/perception.js";

const observation = (source, weaponAuthorization = true) => ({
  trackNumber: source === "organic-radar" ? "P-0001" : "P-0002",
  estimatedPosition: new THREE.Vector3(10, 2, 20),
  estimatedVelocity: new THREE.Vector3(2, 0, -1),
  classification: "aircraft",
  quality: 0.8,
  uncertainty: 3,
  observedAt: 0,
  source,
  weaponAuthorization,
});

let state = updatePilotPerception({
  state: initialPilotPerception(),
  observations: [observation("organic-radar"), observation("tactical-network")],
  time: 0,
  memorySeconds: 10,
}).state;
const organic = state.contacts.get("P-0001");
const network = state.contacts.get("P-0002");
const serialized = JSON.stringify([...state.contacts.values()]);

state = updatePilotPerception({
  state,
  observations: [],
  time: 4,
  memorySeconds: 10,
}).state;
const memoryAtFour = state.contacts.get("P-0001");
state = updatePilotPerception({
  state,
  observations: [],
  time: 5,
  memorySeconds: 10,
}).state;
const memoryAtFive = state.contacts.get("P-0001");
const expired = updatePilotPerception({
  state,
  observations: [],
  time: 11,
  memorySeconds: 10,
}).state;

const result = {
  organicAuthorized: organic?.weaponAuthorization,
  networkAuthorized: network?.weaponAuthorization,
  containsTargetId: serialized.includes("targetId"),
  positionAtFour: memoryAtFour?.estimatedPosition.toArray(),
  positionAtFive: memoryAtFive?.estimatedPosition.toArray(),
  uncertaintyAtFive: memoryAtFive?.uncertainty,
  memoryAuthorized: memoryAtFive?.weaponAuthorization,
  expired: expired.contacts.size,
};
console.log(JSON.stringify(result, null, 2));
if (
  !result.organicAuthorized ||
  result.networkAuthorized ||
  result.containsTargetId ||
  result.positionAtFour?.[0] !== 18 ||
  result.positionAtFive?.[0] !== 20 ||
  !(result.uncertaintyAtFive > 3) ||
  result.memoryAuthorized ||
  result.expired !== 0
) process.exitCode = 1;
