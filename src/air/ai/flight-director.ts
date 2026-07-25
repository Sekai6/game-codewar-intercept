import * as THREE from "three";
import type { AirPlatformDefinition, AirThrustMode } from "../types";
import {
  evaluateAerodynamics,
  evaluateLongitudinalForceBalance,
} from "../flight/aerodynamic-model.js";
import {
  aircraftPerformance,
  type AdvancedFlightState,
} from "../flight/aircraft-performance.js";
import { stepControlLaw } from "../flight/control-law.js";
import { stepEngine } from "../flight/engine-model.js";
import { protectFlightEnvelope } from "../flight/envelope-protection.js";
import {
  coordinatedTurnRateDegPerSecond,
  WORLD_SPEED_TO_METERS_PER_SECOND,
  WORLD_ALTITUDE_TO_METERS,
} from "../flight/units.js";

const clamp = THREE.MathUtils.clamp;
const DEG = THREE.MathUtils.radToDeg;
const RAD = THREE.MathUtils.degToRad;

export interface FlightDirectorIntent {
  desiredDirection: THREE.Vector3;
  thrustMode: AirThrustMode;
  energyPriority: "preserve" | "neutral" | "spend";
  bankLimitDeg?: number;
  loadFactorCommand?: number;
}

export function stepFlightDirector(input: {
  definition: AirPlatformDefinition;
  state: AdvancedFlightState;
  heading: THREE.Vector3;
  speed: number;
  altitude: number;
  bankRad: number;
  flightControlHealth: number;
  engineHealth: number;
  afterburnerRemaining: number;
  externalStoresMassKg?: number;
  externalDragIndex?: number;
  intent: FlightDirectorIntent;
  dt: number;
}) {
  const performance = aircraftPerformance(input.definition);
  const externalStoresMassKg = Math.max(0, input.externalStoresMassKg ?? 0);
  const grossMassRatio = 1 + externalStoresMassKg /
    Math.max(1, performance.referenceMassKg);
  const effectiveStallSpeed = input.definition.flight.stallSpeed *
    Math.sqrt(grossMassRatio);
  const currentHeadingDeg = DEG(Math.atan2(input.heading.x, -input.heading.z));
  const desiredHeadingDeg = DEG(Math.atan2(
    input.intent.desiredDirection.x,
    -input.intent.desiredDirection.z,
  ));
  const currentPathDeg = DEG(Math.asin(clamp(input.heading.y, -1, 1)));
  const desiredPathDeg = DEG(Math.asin(
    clamp(input.intent.desiredDirection.y, -1, 1),
  ));
  const controls = stepControlLaw({
    currentBankDeg: DEG(input.bankRad),
    currentAngleOfAttackDeg: input.state.angleOfAttackDeg,
    currentFlightPathDeg: currentPathDeg,
    desiredHeadingDeg,
    currentHeadingDeg,
    desiredFlightPathDeg: desiredPathDeg,
    maximumRollRateDeg: input.definition.flight.maxRollRateDeg,
    maximumLoadFactor: input.definition.flight.maxLoadFactor,
    flightControlHealth: input.flightControlHealth,
    dt: input.dt,
    performance,
    desiredBankLimitDeg: input.intent.bankLimitDeg,
    loadFactorCommand: input.intent.loadFactorCommand,
  });
  const preliminary = evaluateAerodynamics({
    speed: input.speed,
    altitude: input.altitude,
    angleOfAttackDeg: controls.angleOfAttackDeg,
    bankDeg: controls.bankDeg,
    maximumLoadFactor: input.definition.flight.maxLoadFactor,
    stallSpeed: effectiveStallSpeed,
    flightControlHealth: input.flightControlHealth,
    grossMassRatio,
    performance,
  });
  const protection = protectFlightEnvelope({
    requestedAngleOfAttackDeg: controls.angleOfAttackDeg,
    requestedLoadFactor: controls.requestedLoadFactor,
    availableLoadFactor: preliminary.availableLoadFactor,
    speed: input.speed,
    stallSpeed: effectiveStallSpeed,
    altitude: input.altitude,
    performance,
  });
  const aero = evaluateAerodynamics({
    speed: input.speed,
    altitude: input.altitude,
    angleOfAttackDeg: protection.angleOfAttackDeg,
    bankDeg: controls.bankDeg,
    maximumLoadFactor: input.definition.flight.maxLoadFactor,
    stallSpeed: effectiveStallSpeed,
    flightControlHealth: input.flightControlHealth,
    grossMassRatio,
    performance,
  });
  const engine = stepEngine({
    currentSpool: input.state.engineSpool,
    requestedMode: input.intent.thrustMode,
    afterburnerAvailable: input.definition.flight.thrust.afterburnerAvailable,
    afterburnerRemaining: input.afterburnerRemaining,
    engineHealth: input.engineHealth,
    dt: input.dt,
    performance,
  });
  const loadStep = Math.max(0.5, 3.5 * input.flightControlHealth) * input.dt;
  const realizedLoadFactor = input.state.loadFactor + clamp(
    protection.loadFactor - input.state.loadFactor,
    -loadStep,
    loadStep,
  );
  const flight = input.definition.flight;
  const modeFactor = engine.thrustMode === "idle" ? 0.18
    : engine.thrustMode === "cruise" ? 0.72
    : engine.thrustMode === "military" ? flight.thrust.militaryAccelerationFactor
    : flight.thrust.afterburnerAccelerationFactor;
  const forceBalance = evaluateLongitudinalForceBalance({
    speed: input.speed,
    altitude: input.altitude,
    flightPathDeg: currentPathDeg,
    loadFactor: realizedLoadFactor,
    stallSpeed: effectiveStallSpeed,
    maximumSpeed: flight.maxSpeed,
    baseAcceleration: flight.acceleration,
    baseDrag: flight.drag,
    thrustModeFactor: modeFactor,
    thrustFraction: engine.thrustFraction,
    grossMassRatio,
    externalDragIndex: input.externalDragIndex,
    aerodynamics: aero,
  });
  const acceleration = forceBalance.netAcceleration;
  const speed = clamp(
    input.speed + acceleration * input.dt,
    effectiveStallSpeed * 0.72,
    flight.maxSpeed,
  );
  const bankTurnRateDeg = coordinatedTurnRateDegPerSecond({
    speedWorld: input.speed,
    bankDeg: controls.bankDeg,
  });
  const turnSpeedMetersPerSecond = Math.max(
    1,
    input.speed * WORLD_SPEED_TO_METERS_PER_SECOND,
  );
  const loadLimitedRateDeg = DEG(
    9.81 * Math.sqrt(Math.max(0, realizedLoadFactor ** 2 - 1)) /
      turnSpeedMetersPerSecond,
  );
  const turnRateDeg = Math.sign(bankTurnRateDeg) * Math.min(
    Math.abs(bankTurnRateDeg),
    loadLimitedRateDeg,
  );
  const headingDeg = currentHeadingDeg + turnRateDeg * input.dt;
  const pitchResponse = protection.mode === "stall-recovery" ? -8 :
    clamp(controls.pathError, -flight.maxPitchRateDeg, flight.maxPitchRateDeg);
  const pathDeg = currentPathDeg + clamp(
    pitchResponse,
    -flight.maxPitchRateDeg,
    flight.maxPitchRateDeg,
  ) * input.dt;
  const horizontal = Math.cos(RAD(pathDeg));
  const heading = new THREE.Vector3(
    Math.sin(RAD(headingDeg)) * horizontal,
    Math.sin(RAD(pathDeg)),
    -Math.cos(RAD(headingDeg)) * horizontal,
  ).normalize();
  const speedMetersPerSecond = speed * WORLD_SPEED_TO_METERS_PER_SECOND;
  const specificEnergy = input.altitude * WORLD_ALTITUDE_TO_METERS +
    speedMetersPerSecond * speedMetersPerSecond / (2 * 9.81);
  const specificExcessPower = acceleration * WORLD_SPEED_TO_METERS_PER_SECOND *
    speedMetersPerSecond / 9.81;
  const multiplier = engine.thrustMode === "idle" ? 0.28
    : engine.thrustMode === "cruise" ? 1
    : engine.thrustMode === "military" ? flight.thrust.militaryFuelMultiplier
    : flight.thrust.afterburnerFuelMultiplier;
  const fuelBurn = input.dt * multiplier * (0.58 + engine.engineSpool * 0.62);
  const state: AdvancedFlightState = {
    angleOfAttackDeg: protection.angleOfAttackDeg,
    sideslipDeg: clamp((desiredHeadingDeg - currentHeadingDeg) * 0.025, -5, 5),
    loadFactor: realizedLoadFactor,
    dynamicPressure: aero.dynamicPressure,
    specificEnergy,
    specificExcessPower,
    thrustAcceleration: forceBalance.thrustAcceleration,
    parasiteDragAcceleration: forceBalance.parasiteDragAcceleration,
    inducedDragAcceleration: forceBalance.inducedDragAcceleration,
    gravityAcceleration: forceBalance.gravityAcceleration,
    externalStoresMassKg,
    grossMassRatio,
    effectiveStallSpeed,
    engineSpool: engine.engineSpool,
    stalled: aero.stalled,
    controlMode: protection.mode,
    updateCount: input.state.updateCount + 1,
  };
  return {
    state,
    heading,
    speed,
    bankRad: RAD(controls.bankDeg),
    thrustMode: engine.thrustMode,
    afterburnerUsed: engine.afterburnerUsed,
    fuelBurn,
  };
}
