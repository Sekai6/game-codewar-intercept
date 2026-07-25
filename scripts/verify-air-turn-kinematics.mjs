import * as THREE from "three";
import { stepFlightDirector } from "../dist-test/air/ai/flight-director.js";
import { initialAdvancedFlightState } from "../dist-test/air/flight/aircraft-performance.js";
import { coordinatedTurnRateDegPerSecond } from "../dist-test/air/flight/units.js";
import { evaluateAerodynamics } from "../dist-test/air/flight/aerodynamic-model.js";
import { aircraftPerformance } from "../dist-test/air/flight/aircraft-performance.js";

const definition = {
  id: "F-14A",
  flight: {
    cruiseSpeed: 5.1,
    maxSpeed: 11.5,
    stallSpeed: 2.1,
    acceleration: 1.1,
    drag: 0.018,
    maxLoadFactor: 7.5,
    maxRollRateDeg: 120,
    maxPitchRateDeg: 28,
    maxAngleOfAttackDeg: 18,
    fuelSeconds: 900,
    thrust: {
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
    },
  },
};
const heading = new THREE.Vector3(0, 0, -1);
let state = initialAdvancedFlightState(definition);
let bankRad = 0;
let maximumQuarterSecondHeadingChange = 0;
for (let index = 0; index < 8; index++) {
  const previous = heading.clone();
  const step = stepFlightDirector({
    definition,
    state,
    heading,
    speed: definition.flight.cruiseSpeed,
    altitude: 36,
    bankRad,
    flightControlHealth: 1,
    engineHealth: 1,
    afterburnerRemaining: 60,
    intent: {
      desiredDirection: new THREE.Vector3(1, 0, 0),
      thrustMode: "military",
      energyPriority: "preserve",
    },
    dt: 0.25,
  });
  state = step.state;
  bankRad = step.bankRad;
  heading.copy(step.heading);
  maximumQuarterSecondHeadingChange = Math.max(
    maximumQuarterSecondHeadingChange,
    THREE.MathUtils.radToDeg(previous.angleTo(heading)),
  );
}
const sustainedRate = coordinatedTurnRateDegPerSecond({
  speedWorld: definition.flight.cruiseSpeed,
  bankDeg: 72,
});
const performance = aircraftPerformance(definition);
const seaLevelEnvelope = evaluateAerodynamics({
  speed: definition.flight.cruiseSpeed,
  altitude: 0,
  angleOfAttackDeg: 8,
  bankDeg: 70,
  maximumLoadFactor: definition.flight.maxLoadFactor,
  stallSpeed: definition.flight.stallSpeed,
  flightControlHealth: 1,
  performance,
});
const highAltitudeEnvelope = evaluateAerodynamics({
  speed: definition.flight.cruiseSpeed,
  altitude: 100,
  angleOfAttackDeg: 8,
  bankDeg: 70,
  maximumLoadFactor: definition.flight.maxLoadFactor,
  stallSpeed: definition.flight.stallSpeed,
  flightControlHealth: 1,
  performance,
});
const result = {
  sustainedRate,
  maximumQuarterSecondHeadingChange,
  finalHeading: heading.toArray(),
  seaLevelAvailableG: seaLevelEnvelope.availableLoadFactor,
  highAltitudeAvailableG: highAltitudeEnvelope.availableLoadFactor,
};
console.log(JSON.stringify(result, null, 2));
if (
  sustainedRate < 10 || sustainedRate > 14 ||
  maximumQuarterSecondHeadingChange > 3.6 ||
  maximumQuarterSecondHeadingChange < 0.1 ||
  highAltitudeEnvelope.availableLoadFactor >= seaLevelEnvelope.availableLoadFactor
) process.exitCode = 1;
