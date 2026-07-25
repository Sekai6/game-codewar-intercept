import * as THREE from "three";
import type { AirPlatformDefinition, AirThrustMode } from "../types";
import { evaluateAerodynamics } from "../flight/aerodynamic-model.js";
import {
  aircraftPerformance,
  type AdvancedFlightState,
} from "../flight/aircraft-performance.js";
import { stepControlLaw } from "../flight/control-law.js";
import { stepEngine } from "../flight/engine-model.js";
import { protectFlightEnvelope } from "../flight/envelope-protection.js";

const clamp = THREE.MathUtils.clamp;
const DEG = THREE.MathUtils.radToDeg;
const RAD = THREE.MathUtils.degToRad;

export interface FlightDirectorIntent {
  desiredDirection: THREE.Vector3;
  thrustMode: AirThrustMode;
  energyPriority: "preserve" | "neutral" | "spend";
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
  intent: FlightDirectorIntent;
  dt: number;
}) {
  const performance = aircraftPerformance(input.definition);
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
  });
  const preliminary = evaluateAerodynamics({
    speed: input.speed,
    altitude: input.altitude,
    angleOfAttackDeg: controls.angleOfAttackDeg,
    bankDeg: controls.bankDeg,
    maximumLoadFactor: input.definition.flight.maxLoadFactor,
    stallSpeed: input.definition.flight.stallSpeed,
    flightControlHealth: input.flightControlHealth,
    performance,
  });
  const protection = protectFlightEnvelope({
    requestedAngleOfAttackDeg: controls.angleOfAttackDeg,
    requestedLoadFactor: controls.requestedLoadFactor,
    availableLoadFactor: preliminary.availableLoadFactor,
    speed: input.speed,
    stallSpeed: input.definition.flight.stallSpeed,
    altitude: input.altitude,
    performance,
  });
  const aero = evaluateAerodynamics({
    speed: input.speed,
    altitude: input.altitude,
    angleOfAttackDeg: protection.angleOfAttackDeg,
    bankDeg: controls.bankDeg,
    maximumLoadFactor: input.definition.flight.maxLoadFactor,
    stallSpeed: input.definition.flight.stallSpeed,
    flightControlHealth: input.flightControlHealth,
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
  const flight = input.definition.flight;
  const modeFactor = engine.thrustMode === "idle" ? 0.18
    : engine.thrustMode === "cruise" ? 0.72
    : engine.thrustMode === "military" ? flight.thrust.militaryAccelerationFactor
    : flight.thrust.afterburnerAccelerationFactor;
  const thrustAcceleration = flight.acceleration * modeFactor * engine.thrustFraction;
  const dragAcceleration = flight.drag * input.speed * input.speed *
    (0.7 + aero.dragCoefficient * 8);
  const climbLoss = Math.max(0, Math.sin(RAD(currentPathDeg))) * 0.45;
  const loadLoss = Math.max(0, protection.loadFactor - 1) * 0.055;
  const acceleration = thrustAcceleration - dragAcceleration - climbLoss - loadLoss;
  const speed = clamp(
    input.speed + acceleration * input.dt,
    flight.stallSpeed * 0.72,
    flight.maxSpeed,
  );
  const turnRateDeg = DEG(9.81 * Math.tan(RAD(controls.bankDeg)) /
    Math.max(0.5, input.speed));
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
  const specificEnergy = input.altitude + speed * speed / (2 * 9.81);
  const specificExcessPower = acceleration * speed / 9.81;
  const multiplier = engine.thrustMode === "idle" ? 0.28
    : engine.thrustMode === "cruise" ? 1
    : engine.thrustMode === "military" ? flight.thrust.militaryFuelMultiplier
    : flight.thrust.afterburnerFuelMultiplier;
  const fuelBurn = input.dt * multiplier * (0.58 + engine.engineSpool * 0.62);
  const state: AdvancedFlightState = {
    angleOfAttackDeg: protection.angleOfAttackDeg,
    sideslipDeg: clamp((desiredHeadingDeg - currentHeadingDeg) * 0.025, -5, 5),
    loadFactor: protection.loadFactor,
    dynamicPressure: aero.dynamicPressure,
    specificEnergy,
    specificExcessPower,
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
