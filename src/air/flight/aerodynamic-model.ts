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
  grossMassRatio?: number;
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
      (input.performance.wingLoadingFactor * (input.grossMassRatio ?? 1)),
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

export interface LongitudinalForceBalance {
  thrustAcceleration: number;
  parasiteDragAcceleration: number;
  inducedDragAcceleration: number;
  gravityAcceleration: number;
  netAcceleration: number;
}

/**
 * Point-mass force balance in world-speed units. The catalog acceleration and
 * drag values remain game-scaled, while density, load and flight-path effects
 * follow the same relationships as dimensional lift/drag equations.
 */
export function evaluateLongitudinalForceBalance(input: {
  speed: number;
  altitude: number;
  flightPathDeg: number;
  loadFactor: number;
  stallSpeed: number;
  maximumSpeed: number;
  baseAcceleration: number;
  baseDrag: number;
  thrustModeFactor: number;
  thrustFraction: number;
  grossMassRatio?: number;
  externalDragIndex?: number;
  aerodynamics: ReturnType<typeof evaluateAerodynamics>;
}): LongitudinalForceBalance {
  const density = input.aerodynamics.densityRatio;
  const speedRatio = clamp(
    input.speed / Math.max(input.stallSpeed, input.maximumSpeed),
    0,
    1.25,
  );
  // Turbojet/turbofan thrust lapses with density; forward speed restores only
  // a small part of it through ram pressure.
  const thrustLapse = clamp(
    0.34 + density * 0.66 + speedRatio * 0.08,
    0.32,
    1.06,
  );
  const grossMassRatio = Math.max(1, input.grossMassRatio ?? 1);
  const thrustAcceleration = input.baseAcceleration * input.thrustModeFactor *
    input.thrustFraction * thrustLapse / grossMassRatio;
  const parasiteDragAcceleration = input.baseDrag * input.speed * input.speed *
    density * (0.82 + input.aerodynamics.dragCoefficient * 5.5) *
    (1 + Math.max(0, input.externalDragIndex ?? 0));
  // Induced drag follows n^2 / q. The floor keeps the approximation bounded
  // during stall recovery, where the envelope protector owns the response.
  const pressureRatio = Math.max(0.22,
    input.aerodynamics.dynamicPressureRatio);
  const inducedDragAcceleration = input.baseDrag * input.stallSpeed ** 2 *
    0.72 * Math.max(0, input.loadFactor ** 2 - 1) / pressureRatio;
  const gravityWorld = 9.81 / WORLD_SPEED_TO_METERS_PER_SECOND;
  const gravityAcceleration = gravityWorld *
    Math.sin(input.flightPathDeg * Math.PI / 180);
  return {
    thrustAcceleration,
    parasiteDragAcceleration,
    inducedDragAcceleration,
    gravityAcceleration,
    netAcceleration: thrustAcceleration - parasiteDragAcceleration -
      inducedDragAcceleration - gravityAcceleration,
  };
}
