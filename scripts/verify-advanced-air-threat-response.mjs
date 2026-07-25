import * as THREE from "three";
import { planThreatResponse } from "../dist-test/air/ai/threat-response.js";
import { stepFlightDirector } from "../dist-test/air/ai/flight-director.js";
import { initialAdvancedFlightState } from "../dist-test/air/flight/aircraft-performance.js";

const warning = {
  position: new THREE.Vector3(0, 40, -60),
  velocity: new THREE.Vector3(0, 0, 12),
  quality: 0.7,
  uncertainty: 4,
};
const plan = (tti, guidance = "active-radar", overrides = {}) =>
  planThreatResponse({
    ownPosition: new THREE.Vector3(0, 40, 0),
    currentHeading: new THREE.Vector3(0, 0, -1),
    warning,
    estimatedTti: tti,
    guidance,
    preferredSide: 1,
    altitude: 40,
    speedRatio: 0.7,
    ...overrides,
  });
const early = plan(28);
const notch = plan(14);
const breakPlan = plan(5);
const infrared = plan(5, "infrared");
const lowEnergy = plan(28, "active-radar", { speedRatio: 0.3 });
const breakHysteresis = plan(8.5, "active-radar", { previousPhase: "break" });
const floorProtected = plan(5, "active-radar", { altitude: 2 });
const recovered = planThreatResponse({
  ownPosition: new THREE.Vector3(),
  currentHeading: new THREE.Vector3(0, 0, -1),
  preferredSide: 1,
  altitude: 20,
  speedRatio: 0.7,
  previousPhase: "break",
});
const radial = warning.position.clone().setY(40)
  .sub(new THREE.Vector3(0, 40, 0)).normalize();
const result = {
  phases: [early.phase, notch.phase, breakPlan.phase, lowEnergy.phase, recovered.phase],
  notchRadialDot: Math.abs(radial.dot(notch.desiredDirection.clone().setY(0).normalize())),
  breakBank: breakPlan.bankLimitDeg,
  breakLoad: breakPlan.loadFactorFraction,
  radarCountermeasure: breakPlan.countermeasure,
  infraredCountermeasure: infrared.countermeasure,
  breakHysteresis: breakHysteresis.phase,
  floorVerticalCommand: floorProtected.desiredDirection.y,
};
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
let heading = new THREE.Vector3(0, 0, -1);
let bankRad = 0;
let speed = 5.1;
let maxStepHeadingChange = 0;
let firstSecondLoad = 0;
for (let index = 0; index < 20; index++) {
  const previous = heading.clone();
  const step = stepFlightDirector({
    definition, state: flightState, heading, speed, altitude: 40, bankRad,
    flightControlHealth: 1, engineHealth: 1, afterburnerRemaining: 60,
    intent: {
      desiredDirection: breakPlan.desiredDirection,
      thrustMode: "military",
      energyPriority: breakPlan.energyPriority,
      bankLimitDeg: breakPlan.bankLimitDeg,
      loadFactorCommand: definition.flight.maxLoadFactor * breakPlan.loadFactorFraction,
    },
    dt: 0.25,
  });
  flightState = step.state;
  heading = step.heading;
  speed = step.speed;
  bankRad = step.bankRad;
  if (index === 3) firstSecondLoad = flightState.loadFactor;
  maxStepHeadingChange = Math.max(
    maxStepHeadingChange,
    THREE.MathUtils.radToDeg(previous.angleTo(heading)),
  );
}
result.execution = {
  finalRadialDot: Math.abs(radial.dot(heading.clone().setY(0).normalize())),
  maxStepHeadingChange,
  firstSecondLoad,
  finalLoad: flightState.loadFactor,
};
console.log(JSON.stringify(result, null, 2));
if (
  result.phases.join(",") !== "notch,notch,break,drag,recover" ||
  result.notchRadialDot > 0.02 ||
  result.breakBank < 80 ||
  result.breakLoad < 0.9 ||
  result.radarCountermeasure !== "chaff" ||
  result.infraredCountermeasure !== "flare" ||
  result.breakHysteresis !== "break" ||
  result.floorVerticalCommand <= 0 ||
  result.execution.finalRadialDot > 0.65 ||
  result.execution.maxStepHeadingChange > 7.5 ||
  result.execution.firstSecondLoad > 5 ||
  result.execution.finalLoad > definition.flight.maxLoadFactor
) process.exitCode = 1;
