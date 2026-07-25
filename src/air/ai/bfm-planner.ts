import * as THREE from "three";
import type { AirTacticalMode } from "./tactical-state.js";
import {
  defensiveTurnManeuver,
  lagPursuitManeuver,
  leadPursuitManeuver,
  scissorsManeuver,
} from "./maneuver-library.js";
import type { TacticalTrackObservation } from "./tactical-planner.js";

const clamp = THREE.MathUtils.clamp;
const degrees = THREE.MathUtils.radToDeg;

export interface BfmPlan {
  mode: AirTacticalMode;
  desiredDirection: THREE.Vector3;
  energyPriority: "preserve" | "neutral" | "spend";
  bankLimitDeg: number;
  loadFactorFraction: number;
  shotOpportunity: boolean;
  range: number;
  closureRate: number;
  angleOffNoseDeg: number;
  targetAspectDeg: number;
}

export function planBfmManeuver(input: {
  ownPosition: THREE.Vector3;
  ownVelocity: THREE.Vector3;
  currentHeading: THREE.Vector3;
  targetTrack: TacticalTrackObservation;
  formationSide: -1 | 1;
  altitude: number;
  speedRatio: number;
  specificEnergyAdvantage: number;
  time: number;
}): BfmPlan | null {
  const line = input.targetTrack.position.clone().sub(input.ownPosition);
  const range = line.length();
  if (range > 90 || range < 0.001) return null;
  const los = line.clone().multiplyScalar(1 / range);
  const targetSpeed = input.targetTrack.velocity.length();
  const targetHeading = targetSpeed > 0.05
    ? input.targetTrack.velocity.clone().multiplyScalar(1 / targetSpeed)
    : los.clone().negate();
  const relativeVelocity = input.targetTrack.velocity.clone()
    .sub(input.ownVelocity);
  const closureRate = -relativeVelocity.dot(los);
  const angleOffNoseDeg = degrees(input.currentHeading.angleTo(los));
  const targetAspectDeg = degrees(targetHeading.angleTo(los.clone().negate()));
  const attackerBehind = angleOffNoseDeg > 105 && range < 55;
  const lowAltitude = input.altitude < 7;
  const lowEnergy = input.speedRatio < 0.48 || input.specificEnergyAdvantage < -900;
  let mode: AirTacticalMode;
  let desiredDirection: THREE.Vector3;
  let energyPriority: BfmPlan["energyPriority"];
  let bankLimitDeg: number;
  let loadFactorFraction: number;

  if (attackerBehind) {
    mode = "bfm-defensive-turn";
    desiredDirection = defensiveTurnManeuver({
      lineOfSight: los,
      currentHeading: input.currentHeading,
      side: input.formationSide,
      climbBias: lowAltitude ? 0.2 : 0.02,
    });
    energyPriority = lowEnergy ? "preserve" : "spend";
    bankLimitDeg = 80;
    loadFactorFraction = lowEnergy ? 0.62 : 0.9;
  } else if (range < 22 && Math.abs(closureRate) < 1.4 && angleOffNoseDeg > 35) {
    mode = "bfm-scissors";
    desiredDirection = scissorsManeuver({
      currentHeading: input.currentHeading,
      lineOfSight: los,
      side: input.formationSide,
      time: input.time,
      climbBias: lowAltitude ? 0.18 : 0.03,
    });
    energyPriority = "preserve";
    bankLimitDeg = 76;
    loadFactorFraction = 0.72;
  } else if (targetAspectDeg < 75 && angleOffNoseDeg < 75 &&
      (lowEnergy || closureRate > 2.8)) {
    mode = "bfm-one-circle";
    desiredDirection = los.clone().addScaledVector(targetHeading, -0.38)
      .setY(lowAltitude ? 0.12 : los.y).normalize();
    energyPriority = "spend";
    bankLimitDeg = 82;
    loadFactorFraction = 0.92;
  } else if (input.speedRatio > 0.62 && input.specificEnergyAdvantage >= -300) {
    mode = "bfm-two-circle";
    desiredDirection = leadPursuitManeuver({
      ownPosition: input.ownPosition,
      targetPosition: input.targetTrack.position,
      targetVelocity: input.targetTrack.velocity,
      ownSpeed: input.ownVelocity.length(),
      climbBias: lowAltitude ? 0.12 : 0,
    });
    energyPriority = "preserve";
    bankLimitDeg = 78;
    loadFactorFraction = 0.78;
  } else {
    mode = "bfm-lag-pursuit";
    desiredDirection = lagPursuitManeuver({
      ownPosition: input.ownPosition,
      targetPosition: input.targetTrack.position,
      targetVelocity: input.targetTrack.velocity,
      climbBias: lowAltitude ? 0.14 : 0,
    });
    energyPriority = "preserve";
    bankLimitDeg = 70;
    loadFactorFraction = 0.58;
  }

  const rearQuarter = targetHeading.dot(los) > 0.25;
  const shotOpportunity = range >= 2 && range <= 60 &&
    angleOffNoseDeg <= clamp(28 - range * 0.16, 10, 26) &&
    (rearQuarter || range <= 24) && Math.abs(closureRate) <= 8;
  return {
    mode,
    desiredDirection,
    energyPriority,
    bankLimitDeg,
    loadFactorFraction,
    shotOpportunity,
    range,
    closureRate,
    angleOffNoseDeg,
    targetAspectDeg,
  };
}
