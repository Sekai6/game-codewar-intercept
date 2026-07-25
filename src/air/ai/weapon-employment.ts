import * as THREE from "three";
import type { AirWeaponDefinition } from "../types";
import type { TacticalTrackObservation } from "./tactical-planner.js";

const clamp = THREE.MathUtils.clamp;

export interface DynamicLaunchZone {
  rMin: number;
  rNe: number;
  rTr: number;
  rMax: number;
  range: number;
  closureRate: number;
  altitudeAdvantage: number;
  shotQuality: number;
}

export function calculateDynamicLaunchZone(input: {
  weapon: AirWeaponDefinition;
  shooterPosition: THREE.Vector3;
  shooterVelocity: THREE.Vector3;
  shooterMaximumSpeed: number;
  track: TacticalTrackObservation;
}) : DynamicLaunchZone {
  const line = input.track.position.clone().sub(input.shooterPosition);
  const range = Math.max(0.001, line.length());
  const lineUnit = line.multiplyScalar(1 / range);
  const relativeVelocity = input.track.velocity.clone().sub(input.shooterVelocity);
  const closureRate = -relativeVelocity.dot(lineUnit);
  const speedRatio = clamp(
    input.shooterVelocity.length() / Math.max(0.1, input.shooterMaximumSpeed),
    0.2,
    1,
  );
  const altitudeAdvantage = input.shooterPosition.y - input.track.position.y;
  const altitudeFactor = clamp(1 + altitudeAdvantage / 900, 0.72, 1.2);
  const closureFactor = clamp(1 + closureRate / Math.max(1, input.weapon.speed * 3), 0.68, 1.24);
  const energyFactor = clamp(0.72 + speedRatio * 0.4, 0.78, 1.12);
  const uncertaintyFactor = clamp(
    input.track.quality * (1 - input.track.uncertainty / Math.max(20, range)),
    0.35,
    1,
  );
  const rMax = input.weapon.maxRange * altitudeFactor * closureFactor * energyFactor;
  const rTr = rMax * (0.62 + uncertaintyFactor * 0.1);
  const rNe = rMax * (0.39 + Math.max(0, closureFactor - 1) * 0.12);
  const rMin = input.weapon.minRange * (1 + Math.max(0, -closureRate) /
    Math.max(1, input.weapon.speed) * 0.08);
  const rangeScore = clamp((rMax - range) / Math.max(1, rMax - rMin), 0, 1);
  return {
    rMin,
    rNe,
    rTr,
    rMax,
    range,
    closureRate,
    altitudeAdvantage,
    shotQuality: clamp(rangeScore * uncertaintyFactor, 0, 1),
  };
}

export function dynamicShotAllowed(input: {
  zone: DynamicLaunchZone;
  defensive: boolean;
}) {
  return input.zone.range >= input.zone.rMin &&
    input.zone.range <= (input.defensive ? input.zone.rMax : input.zone.rTr);
}
