import type { AirPlatformDefinition } from "../types";
import { WORLD_SPEED_TO_METERS_PER_SECOND } from "./units.js";

export interface AircraftPerformance {
  wingLoadingFactor: number;
  zeroLiftDrag: number;
  inducedDragFactor: number;
  liftCurveSlope: number;
  criticalAngleOfAttackDeg: number;
  controlResponseSeconds: number;
  engineSpoolUpSeconds: number;
  engineSpoolDownSeconds: number;
}

export interface AdvancedFlightState {
  angleOfAttackDeg: number;
  sideslipDeg: number;
  loadFactor: number;
  dynamicPressure: number;
  specificEnergy: number;
  specificExcessPower: number;
  engineSpool: number;
  stalled: boolean;
  controlMode: "normal" | "angle-of-attack-limit" | "stall-recovery";
  updateCount: number;
}

export function initialAdvancedFlightState(
  definition: AirPlatformDefinition,
): AdvancedFlightState {
  const speed = definition.flight.cruiseSpeed;
  const speedMetersPerSecond = speed * WORLD_SPEED_TO_METERS_PER_SECOND;
  return {
    angleOfAttackDeg: 2.5,
    sideslipDeg: 0,
    loadFactor: 1,
    dynamicPressure: 0.5 * 1.225 * speedMetersPerSecond * speedMetersPerSecond,
    specificEnergy: speedMetersPerSecond * speedMetersPerSecond / (2 * 9.81),
    specificExcessPower: 0,
    engineSpool: 0.58,
    stalled: false,
    controlMode: "normal",
    updateCount: 0,
  };
}

export function aircraftPerformance(
  definition: AirPlatformDefinition,
): AircraftPerformance {
  const flight = definition.flight;
  const agility = Math.max(0, Math.min(1,
    (flight.maxLoadFactor - 2.5) / 6.5,
  ));
  const speedBand = Math.max(0, Math.min(1,
    (flight.maxSpeed / Math.max(0.1, flight.cruiseSpeed) - 1.35) / 1.1,
  ));
  return {
    wingLoadingFactor: 1.24 - agility * 0.31,
    zeroLiftDrag: 0.03 - speedBand * 0.007,
    inducedDragFactor: 0.078 - agility * 0.022,
    liftCurveSlope: 0.08 + agility * 0.026,
    criticalAngleOfAttackDeg:
      flight.maxAngleOfAttackDeg ?? (14 + agility * 4),
    controlResponseSeconds: 1.5 - agility * 1.05,
    engineSpoolUpSeconds: 5.4 - speedBand * 2.8,
    engineSpoolDownSeconds: 4.3 - speedBand * 2.1,
  };
}
