import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

function horizontal(direction: THREE.Vector3) {
  const result = direction.clone().setY(0);
  return result.lengthSq() > 0.0001 ? result.normalize() : new THREE.Vector3(0, 0, -1);
}

export function crankManeuver(input: {
  lineOfSight: THREE.Vector3;
  side: -1 | 1;
  climbBias?: number;
}) {
  const los = horizontal(input.lineOfSight);
  const lateral = new THREE.Vector3().crossVectors(UP, los)
    .multiplyScalar(input.side);
  return los.multiplyScalar(0.56).addScaledVector(lateral, 0.83)
    .setY(input.climbBias ?? 0).normalize();
}

export function notchManeuver(input: {
  threatVelocity: THREE.Vector3;
  side: -1 | 1;
  descentBias?: number;
}) {
  const threat = horizontal(input.threatVelocity);
  return new THREE.Vector3().crossVectors(UP, threat)
    .multiplyScalar(input.side)
    .setY(-(input.descentBias ?? 0.08))
    .normalize();
}

export function dragManeuver(input: {
  threatPosition: THREE.Vector3;
  ownPosition: THREE.Vector3;
  descentBias?: number;
}) {
  return input.ownPosition.clone().sub(input.threatPosition)
    .setY(-(input.descentBias ?? 0.04)).normalize();
}

export function pumpManeuver(input: {
  targetPosition: THREE.Vector3;
  ownPosition: THREE.Vector3;
  side: -1 | 1;
}) {
  const away = input.ownPosition.clone().sub(input.targetPosition).setY(0).normalize();
  const lateral = new THREE.Vector3().crossVectors(UP, away)
    .multiplyScalar(input.side);
  return away.multiplyScalar(0.88).addScaledVector(lateral, 0.24)
    .setY(0.02).normalize();
}
