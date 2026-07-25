import * as THREE from "three";

export type AirToAirMissilePhase = "boost" | "midcourse" | "terminal";

export function airToAirMissilePhase(input: {
  age: number;
  boostSeconds: number;
  commandRange: number;
  seekerRange: number;
  seekerAcquired: boolean;
}): AirToAirMissilePhase {
  if (input.age < input.boostSeconds) return "boost";
  if (input.seekerAcquired || input.commandRange <= input.seekerRange) return "terminal";
  return "midcourse";
}

export function airToAirGuidancePoint(input: {
  seekerAcquired: boolean;
  commandPoint: THREE.Vector3;
  measuredTargetPosition?: THREE.Vector3;
}) {
  return input.seekerAcquired && input.measuredTargetPosition
    ? input.measuredTargetPosition.clone()
    : input.commandPoint.clone();
}

export function airToAirMidcourseAimPoint(input: {
  commandPoint: THREE.Vector3;
  missilePosition: THREE.Vector3;
  seekerAcquired: boolean;
  loftAltitude: number;
  loftTransitionRange: number;
}) {
  const aim = input.commandPoint.clone();
  if (input.seekerAcquired || input.loftAltitude <= 0) return aim;
  const horizontalRange = Math.hypot(
    aim.x - input.missilePosition.x,
    aim.z - input.missilePosition.z,
  );
  const loftWeight = THREE.MathUtils.smoothstep(
    horizontalRange,
    input.loftTransitionRange,
    input.loftTransitionRange * 2,
  );
  aim.y = Math.max(aim.y, THREE.MathUtils.lerp(aim.y, input.loftAltitude, loftWeight));
  return aim;
}

export function stepAirToAirPropulsion(input: {
  currentSpeed: number;
  nominalSpeed: number;
  age: number;
  boostSeconds: number;
  sustainSeconds: number;
  coastDragPerSecond: number;
  minimumSpeedFactor: number;
  dt: number;
}) {
  const minimumSpeed = input.nominalSpeed * input.minimumSpeedFactor;
  if (input.age <= input.boostSeconds) {
    return THREE.MathUtils.lerp(
      input.currentSpeed,
      input.nominalSpeed,
      Math.min(1, input.dt * 1.8),
    );
  }
  if (input.age <= input.boostSeconds + input.sustainSeconds) {
    return THREE.MathUtils.lerp(
      input.currentSpeed,
      input.nominalSpeed * 0.94,
      Math.min(1, input.dt * 0.35),
    );
  }
  return Math.max(
    minimumSpeed,
    input.currentSpeed * Math.exp(-input.coastDragPerSecond * input.dt),
  );
}

export function shouldContinueAfterTargetLoss(input: {
  age: number;
  maximumAge: number;
  altitude: number;
}) {
  return input.age <= input.maximumAge && input.altitude >= 0;
}
