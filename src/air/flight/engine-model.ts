import type { AirThrustMode } from "../types";
import type { AircraftPerformance } from "./aircraft-performance";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const MODE_SPOOL: Record<AirThrustMode, number> = {
  idle: 0.18,
  cruise: 0.58,
  military: 0.86,
  afterburner: 1,
};

export function stepEngine(input: {
  currentSpool: number;
  requestedMode: AirThrustMode;
  afterburnerAvailable: boolean;
  afterburnerRemaining: number;
  engineHealth: number;
  dt: number;
  performance: AircraftPerformance;
}) {
  const thrustMode = input.requestedMode === "afterburner" &&
      (!input.afterburnerAvailable || input.afterburnerRemaining <= 0)
    ? "military"
    : input.requestedMode;
  const target = MODE_SPOOL[thrustMode];
  const response = target > input.currentSpool
    ? input.performance.engineSpoolUpSeconds
    : input.performance.engineSpoolDownSeconds;
  const engineSpool = input.currentSpool + clamp(
    target - input.currentSpool,
    -input.dt / response,
    input.dt / response,
  );
  return {
    thrustMode,
    engineSpool,
    thrustFraction: engineSpool * clamp(input.engineHealth, 0, 1),
    afterburnerUsed: thrustMode === "afterburner" ? input.dt : 0,
  };
}
