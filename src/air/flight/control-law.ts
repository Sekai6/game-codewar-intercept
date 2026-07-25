import type { AircraftPerformance } from "./aircraft-performance";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const wrapDeg = (value: number) => ((value + 540) % 360) - 180;

export function stepControlLaw(input: {
  currentBankDeg: number;
  currentAngleOfAttackDeg: number;
  currentFlightPathDeg: number;
  desiredHeadingDeg: number;
  currentHeadingDeg: number;
  desiredFlightPathDeg: number;
  maximumRollRateDeg: number;
  maximumLoadFactor: number;
  flightControlHealth: number;
  dt: number;
  performance: AircraftPerformance;
}) {
  const headingError = wrapDeg(input.desiredHeadingDeg - input.currentHeadingDeg);
  const desiredBankDeg = clamp(headingError * 1.35, -72, 72);
  const rollStep = input.maximumRollRateDeg * input.flightControlHealth * input.dt;
  const bankDeg = input.currentBankDeg + clamp(
    desiredBankDeg - input.currentBankDeg,
    -rollStep,
    rollStep,
  );
  const pathError = input.desiredFlightPathDeg - input.currentFlightPathDeg;
  const requestedLoadFactor = clamp(
    1 + Math.abs(bankDeg) / 34 + Math.max(0, pathError) / 12,
    0.3,
    input.maximumLoadFactor,
  );
  const requestedAngleOfAttackDeg = clamp(
    2.4 + (requestedLoadFactor - 1) * 1.7 + pathError * 0.16,
    -3,
    input.performance.criticalAngleOfAttackDeg * 1.1,
  );
  const response = Math.max(0.05, input.performance.controlResponseSeconds);
  const angleOfAttackDeg = input.currentAngleOfAttackDeg + clamp(
    requestedAngleOfAttackDeg - input.currentAngleOfAttackDeg,
    -input.dt * 12 / response,
    input.dt * 12 / response,
  );
  return { bankDeg, requestedLoadFactor, angleOfAttackDeg, pathError };
}
