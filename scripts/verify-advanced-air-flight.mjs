import * as THREE from "three";
import { stepFlightDirector } from "../dist-test/air/ai/flight-director.js";
import { initialAdvancedFlightState } from "../dist-test/air/flight/aircraft-performance.js";

const thrust = {
  militarySpeedFactor: 1.4,
  militaryAccelerationFactor: 1,
  militaryFuelMultiplier: 1.6,
  militaryInfraredMultiplier: 1.3,
  afterburnerAvailable: true,
  afterburnerSpeedFactor: 2.2,
  afterburnerAccelerationFactor: 1.8,
  afterburnerFuelMultiplier: 4.8,
  afterburnerInfraredMultiplier: 2.8,
  afterburnerSeconds: 120,
};
const definition = {
  id: "F-14A",
  flight: {
    cruiseSpeed: 5,
    maxSpeed: 11,
    stallSpeed: 2,
    acceleration: 1,
    drag: 0.018,
    maxLoadFactor: 8,
    maxRollRateDeg: 120,
    maxPitchRateDeg: 28,
    maxAngleOfAttackDeg: 18,
    fuelSeconds: 900,
    aerodynamics: {
      referenceMassKg: 22000,
      wingAreaM2: 52.5,
      zeroLiftDragCoefficient: 0.024,
      inducedDragFactor: 0.055,
      liftCurveSlopePerDeg: 0.098,
      criticalAngleOfAttackDeg: 20,
      controlResponseSeconds: 0.5,
      engineSpoolUpSeconds: 4.2,
      engineSpoolDownSeconds: 3.1,
    },
    thrust,
  },
};
const step = (overrides = {}) => stepFlightDirector({
  definition,
  state: overrides.state ?? initialAdvancedFlightState(definition),
  heading: overrides.heading ?? new THREE.Vector3(0, 0, -1),
  speed: overrides.speed ?? 5,
  altitude: overrides.altitude ?? 80,
  bankRad: overrides.bankRad ?? 0,
  flightControlHealth: overrides.flightControlHealth ?? 1,
  engineHealth: overrides.engineHealth ?? 1,
  afterburnerRemaining: overrides.afterburnerRemaining ?? 120,
  externalStoresMassKg: overrides.externalStoresMassKg ?? 0,
  externalDragIndex: overrides.externalDragIndex ?? 0,
  intent: overrides.intent ?? {
    desiredDirection: new THREE.Vector3(1, 0.2, -0.2).normalize(),
    thrustMode: "afterburner",
    energyPriority: "preserve",
  },
  dt: overrides.dt ?? 0.05,
});

const first = step();
const loaded = step({ externalStoresMassKg: 2700, externalDragIndex: 0.22 });
let sustained = first;
for (let index = 0; index < 80; index++) {
  sustained = step({
    state: sustained.state,
    heading: sustained.heading,
    speed: sustained.speed,
    bankRad: sustained.bankRad,
  });
}
const stalled = step({
  speed: 1.7,
  altitude: 20,
  state: { ...initialAdvancedFlightState(definition), angleOfAttackDeg: 19 },
  intent: {
    desiredDirection: new THREE.Vector3(0, 0.7, -0.3).normalize(),
    thrustMode: "military",
    energyPriority: "preserve",
  },
});
const result = {
  firstSpool: first.state.engineSpool,
  sustainedSpool: sustained.state.engineSpool,
  headingChangedDeg: THREE.MathUtils.radToDeg(
    new THREE.Vector3(0, 0, -1).angleTo(sustained.heading),
  ),
  loadFactor: sustained.state.loadFactor,
  aoa: sustained.state.angleOfAttackDeg,
  specificEnergy: sustained.state.specificEnergy,
  ps: sustained.state.specificExcessPower,
  recoveryMode: stalled.state.controlMode,
  recoveryAoa: stalled.state.angleOfAttackDeg,
  updates: sustained.state.updateCount,
  cleanMassRatio: first.state.grossMassRatio,
  loadedMassRatio: loaded.state.grossMassRatio,
  cleanStallSpeed: first.state.effectiveStallSpeed,
  loadedStallSpeed: loaded.state.effectiveStallSpeed,
  cleanThrustAcceleration: first.state.thrustAcceleration,
  loadedThrustAcceleration: loaded.state.thrustAcceleration,
  cleanParasiteDrag: first.state.parasiteDragAcceleration,
  loadedParasiteDrag: loaded.state.parasiteDragAcceleration,
};
console.log(JSON.stringify(result, null, 2));
if (
  !(first.state.engineSpool > 0.58 && first.state.engineSpool < 1) ||
  !(sustained.state.engineSpool > first.state.engineSpool) ||
  !(result.headingChangedDeg > 1) ||
  !(result.loadFactor >= 0.25 && result.loadFactor <= definition.flight.maxLoadFactor) ||
  !(result.aoa < definition.flight.maxAngleOfAttackDeg) ||
  !Number.isFinite(result.specificEnergy) ||
  !Number.isFinite(result.ps) ||
  result.recoveryMode !== "stall-recovery" ||
  result.recoveryAoa > 5 ||
  !(result.loadedMassRatio > result.cleanMassRatio) ||
  !(result.loadedStallSpeed > result.cleanStallSpeed) ||
  !(result.loadedThrustAcceleration < result.cleanThrustAcceleration) ||
  !(result.loadedParasiteDrag > result.cleanParasiteDrag) ||
  result.updates !== 81
) process.exitCode = 1;
