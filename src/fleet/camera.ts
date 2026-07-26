import * as THREE from "three";
import type { FleetObservation } from "./observability.js";

export interface FleetCameraFrame {
  center: THREE.Vector3;
  radius: number;
}

export function fleetCameraFrame(observation: FleetObservation): FleetCameraFrame | undefined {
  if (!observation.members.length) return undefined;
  const center = observation.members.reduce(
    (sum, member) => sum.add(new THREE.Vector3(member.x, member.y, member.z)),
    new THREE.Vector3(),
  ).multiplyScalar(1 / observation.members.length);
  const radius = Math.max(
    35,
    ...observation.members.map((member) =>
      center.distanceTo(new THREE.Vector3(member.x, member.y, member.z)),
    ),
  );
  return { center, radius };
}
