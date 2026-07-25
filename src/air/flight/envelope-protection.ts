import type { AircraftPerformance } from "./aircraft-performance";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function protectFlightEnvelope(input: {
  requestedAngleOfAttackDeg: number;
  requestedLoadFactor: number;
  availableLoadFactor: number;
  speed: number;
  stallSpeed: number;
  altitude: number;
  performance: AircraftPerformance;
}) {
  const recovery = input.speed < input.stallSpeed * 0.96 ||
    input.requestedAngleOfAttackDeg >= input.performance.criticalAngleOfAttackDeg;
  const groundRecovery = input.altitude < 3 && input.requestedLoadFactor < 1;
  const mode = recovery
    ? "stall-recovery" as const
    : input.requestedAngleOfAttackDeg >
        input.performance.criticalAngleOfAttackDeg * 0.86
      ? "angle-of-attack-limit" as const
      : "normal" as const;
  return {
    mode,
    angleOfAttackDeg: recovery
      ? Math.min(5, input.requestedAngleOfAttackDeg)
      : clamp(
          input.requestedAngleOfAttackDeg,
          -4,
          input.performance.criticalAngleOfAttackDeg * 0.9,
        ),
    loadFactor: groundRecovery
      ? Math.max(1.8, input.requestedLoadFactor)
      : recovery
        ? Math.min(1, input.requestedLoadFactor)
        : clamp(input.requestedLoadFactor, 0.25, input.availableLoadFactor),
  };
}
