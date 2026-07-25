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

export function leadPursuitManeuver(input: {
  ownPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetVelocity: THREE.Vector3;
  ownSpeed: number;
  climbBias?: number;
}) {
  const range = input.targetPosition.distanceTo(input.ownPosition);
  const leadSeconds = Math.min(5, range / Math.max(0.5, input.ownSpeed * 1.8));
  return input.targetPosition.clone()
    .addScaledVector(input.targetVelocity, leadSeconds)
    .sub(input.ownPosition)
    .setY(input.targetPosition.y - input.ownPosition.y + (input.climbBias ?? 0))
    .normalize();
}

export function lagPursuitManeuver(input: {
  ownPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetVelocity: THREE.Vector3;
  climbBias?: number;
}) {
  return input.targetPosition.clone()
    .addScaledVector(input.targetVelocity, -2.2)
    .sub(input.ownPosition)
    .setY(input.targetPosition.y - input.ownPosition.y + (input.climbBias ?? 0))
    .normalize();
}

export function scissorsManeuver(input: {
  currentHeading: THREE.Vector3;
  lineOfSight: THREE.Vector3;
  side: -1 | 1;
  time: number;
  climbBias?: number;
}) {
  const side = Math.floor(input.time / 2.4) % 2 ? -input.side : input.side;
  const lateral = new THREE.Vector3().crossVectors(UP, horizontal(input.lineOfSight))
    .multiplyScalar(side);
  return horizontal(input.currentHeading).multiplyScalar(0.42)
    .addScaledVector(lateral, 0.91)
    .setY(input.climbBias ?? 0.02)
    .normalize();
}

export function defensiveTurnManeuver(input: {
  lineOfSight: THREE.Vector3;
  currentHeading: THREE.Vector3;
  side: -1 | 1;
  climbBias?: number;
}) {
  const lateral = new THREE.Vector3().crossVectors(UP, horizontal(input.lineOfSight))
    .multiplyScalar(input.side);
  return horizontal(input.currentHeading).multiplyScalar(0.28)
    .addScaledVector(lateral, 0.96)
    .setY(input.climbBias ?? 0.02)
    .normalize();
}
