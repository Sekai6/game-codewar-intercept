import type { AircraftPerformance } from "./aircraft-performance";
import {
  WORLD_ALTITUDE_TO_METERS,
  WORLD_SPEED_TO_METERS_PER_SECOND,
} from "./units.js";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function evaluateAerodynamics(input: {
  speed: number;
  altitude: number;
  angleOfAttackDeg: number;
  bankDeg: number;
  maximumLoadFactor: number;
  stallSpeed: number;
  flightControlHealth: number;
  performance: AircraftPerformance;
}) {
  const altitudeMeters = Math.max(0, input.altitude) *
    WORLD_ALTITUDE_TO_METERS;
  const densityRatio = clamp(Math.exp(-altitudeMeters / 8500), 0.18, 1);
  const speedMetersPerSecond = input.speed * WORLD_SPEED_TO_METERS_PER_SECOND;
  const stallMetersPerSecond = input.stallSpeed *
    WORLD_SPEED_TO_METERS_PER_SECOND;
  const dynamicPressure = 0.5 * 1.225 * densityRatio *
    speedMetersPerSecond * speedMetersPerSecond;
  const stallDynamicPressure = 0.5 * 1.225 *
    stallMetersPerSecond * stallMetersPerSecond;
  const dynamicPressureRatio = dynamicPressure /
    Math.max(1, stallDynamicPressure);
  const liftCoefficient = Math.max(
    0,
    input.performance.liftCurveSlope * input.angleOfAttackDeg,
  );
  const dragCoefficient = input.performance.zeroLiftDrag +
    input.performance.inducedDragFactor * liftCoefficient * liftCoefficient;
  const availableLoadFactor = clamp(
    dynamicPressureRatio * input.flightControlHealth /
      input.performance.wingLoadingFactor,
    1,
    input.maximumLoadFactor,
  );
  const liftLoad = Math.max(
    0.25,
    liftCoefficient * dynamicPressureRatio / 0.42,
  );
  const loadFactor = clamp(
    liftLoad * Math.max(0.2, Math.cos(input.bankDeg * Math.PI / 180)),
    0.25,
    availableLoadFactor,
  );
  const stalled = input.angleOfAttackDeg >=
      input.performance.criticalAngleOfAttackDeg ||
    input.speed < input.stallSpeed * 0.92;
  return {
    densityRatio,
    dynamicPressure,
    dynamicPressureRatio,
    dragCoefficient,
    availableLoadFactor,
    loadFactor,
    stalled,
  };
}
