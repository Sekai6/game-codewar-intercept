import { strict as assert } from "node:assert";
import * as THREE from "three";
import { planBfmManeuver } from "../dist-test/air/ai/bfm-planner.js";
import { stepFlightDirector } from "../dist-test/air/ai/flight-director.js";
import { initialAdvancedFlightState } from "../dist-test/air/flight/aircraft-performance.js";
import {
  minimumStableShotSeconds,
  updateStableShotWindow,
} from "../dist-test/air/ai/weapon-employment.js";

const ownPosition = new THREE.Vector3(0, 40, 0);
const ownVelocity = new THREE.Vector3(0, 0, -5.2);
const heading = ownVelocity.clone().normalize();
const plan = (position, velocity, overrides = {}) => planBfmManeuver({
  ownPosition,
  ownVelocity,
  currentHeading: heading,
  targetTrack: { position, velocity, quality: 0.7, uncertainty: 2 },
  formationSide: 1,
  altitude: 40,
  speedRatio: 0.68,
  specificEnergyAdvantage: 500,
  time: 7,
  ...overrides,
});

const oneCircle = plan(
  new THREE.Vector3(0, 40, -40),
  new THREE.Vector3(0, 0, 5),
);
const twoCircle = plan(
  new THREE.Vector3(10, 40, -55),
  new THREE.Vector3(0, 0, -4.6),
);
const defensive = plan(
  new THREE.Vector3(4, 40, 30),
  new THREE.Vector3(0, 0, -5.5),
);
const scissors = plan(
  new THREE.Vector3(12, 40, -12),
  new THREE.Vector3(0, 0, -5.2),
);
const floorDefense = plan(
  new THREE.Vector3(4, 2, 30),
  new THREE.Vector3(0, 0, -5.5),
  { ownPosition: new THREE.Vector3(0, 2, 0), altitude: 2 },
);
const tailShot = plan(
  new THREE.Vector3(0, 40, -30),
  new THREE.Vector3(0, 0, -4),
);
assert.equal(oneCircle?.mode, "bfm-one-circle");
assert.equal(twoCircle?.mode, "bfm-two-circle");
assert.equal(defensive?.mode, "bfm-defensive-turn");
assert.equal(scissors?.mode, "bfm-scissors");
assert.ok((floorDefense?.desiredDirection.y ?? 0) > 0);
assert.equal(tailShot?.shotOpportunity, true);
let shotWindow = updateStableShotWindow({
  previousSeconds: 0,
  opportunity: true,
  elapsedSeconds: 0.7,
});
assert.ok(shotWindow < minimumStableShotSeconds("infrared"));
shotWindow = updateStableShotWindow({
  previousSeconds: shotWindow,
  opportunity: true,
  elapsedSeconds: 0.7,
});
assert.ok(shotWindow >= minimumStableShotSeconds("infrared"));
assert.equal(updateStableShotWindow({
  previousSeconds: shotWindow,
  opportunity: false,
  elapsedSeconds: 0.1,
}), 0);

const definition = {
  id: "TEST-FIGHTER",
  flight: {
    cruiseSpeed: 5.1, maxSpeed: 11.5, stallSpeed: 2.1,
    acceleration: 1.1, drag: 0.018, maxLoadFactor: 7.5,
    maxRollRateDeg: 120, maxPitchRateDeg: 28, maxAngleOfAttackDeg: 18,
    fuelSeconds: 900,
    thrust: {
      militarySpeedFactor: 1.4, militaryAccelerationFactor: 1,
      militaryFuelMultiplier: 1.6, militaryInfraredMultiplier: 1.3,
      afterburnerAvailable: true, afterburnerSpeedFactor: 2.2,
      afterburnerAccelerationFactor: 1.8, afterburnerFuelMultiplier: 4.8,
      afterburnerInfraredMultiplier: 2.8, afterburnerSeconds: 120,
    },
  },
};
let flightState = initialAdvancedFlightState(definition);
let integratedHeading = heading.clone();
let speed = 5.2;
let bankRad = 0;
let altitude = 4;
let maximumStepChange = 0;
let minimumAltitude = altitude;
for (let index = 0; index < 32; index++) {
  const previous = integratedHeading.clone();
  const step = stepFlightDirector({
    definition,
    state: flightState,
    heading: integratedHeading,
    speed,
    altitude,
    bankRad,
    flightControlHealth: 1,
    engineHealth: 1,
    afterburnerRemaining: 60,
    intent: {
      desiredDirection: floorDefense.desiredDirection,
      thrustMode: "military",
      energyPriority: floorDefense.energyPriority,
      bankLimitDeg: floorDefense.bankLimitDeg,
      loadFactorCommand: definition.flight.maxLoadFactor *
        floorDefense.loadFactorFraction,
    },
    dt: 0.25,
  });
  flightState = step.state;
  integratedHeading = step.heading;
  speed = step.speed;
  bankRad = step.bankRad;
  altitude += integratedHeading.y * speed * 0.25;
  minimumAltitude = Math.min(minimumAltitude, altitude);
  maximumStepChange = Math.max(maximumStepChange,
    THREE.MathUtils.radToDeg(previous.angleTo(integratedHeading)));
}
assert.ok(minimumAltitude >= 3.9);
assert.ok(maximumStepChange < 5);
assert.ok(integratedHeading.angleTo(heading) > THREE.MathUtils.degToRad(25));

console.log(JSON.stringify({
  modes: [oneCircle.mode, twoCircle.mode, defensive.mode, scissors.mode],
  floorVerticalCommand: floorDefense.desiredDirection.y,
  integratedHeadingChangeDeg: THREE.MathUtils.radToDeg(heading.angleTo(integratedHeading)),
  maximumQuarterSecondChangeDeg: maximumStepChange,
  minimumAltitude,
  finalSpeed: speed,
  finalLoadFactor: flightState.loadFactor,
  stableShotWindow: shotWindow,
}, null, 2));
