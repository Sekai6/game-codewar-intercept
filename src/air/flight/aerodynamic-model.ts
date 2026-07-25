import type { AircraftPerformance } from "./aircraft-performance";

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
  const densityRatio = clamp(1 - input.altitude / 2200, 0.32, 1);
  const dynamicPressure = 0.5 * densityRatio * input.speed * input.speed;
  const liftCoefficient = Math.max(
    0,
    input.performance.liftCurveSlope * input.angleOfAttackDeg,
  );
  const dragCoefficient = input.performance.zeroLiftDrag +
    input.performance.inducedDragFactor * liftCoefficient * liftCoefficient;
  const speedAuthority = clamp(
    (input.speed / Math.max(0.1, input.stallSpeed) - 0.72) / 0.9,
    0,
    1,
  );
  const availableLoadFactor = Math.max(
    1,
    input.maximumLoadFactor * speedAuthority * input.flightControlHealth /
      input.performance.wingLoadingFactor,
  );
  const liftLoad = Math.max(
    0.25,
    liftCoefficient * dynamicPressure /
      Math.max(0.1, input.stallSpeed * input.stallSpeed * 0.05),
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
    dragCoefficient,
    availableLoadFactor,
    loadFactor,
    stalled,
  };
}
