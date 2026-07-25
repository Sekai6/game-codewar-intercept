import assert from "node:assert/strict";
import { aircraftPerformance } from "../dist-test/air/flight/aircraft-performance.js";
import {
  evaluateAerodynamics,
  evaluateLongitudinalForceBalance,
} from "../dist-test/air/flight/aerodynamic-model.js";

const definition = {
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
  },
};
const performance = aircraftPerformance(definition);
const aero = (altitude, loadFactor = 1) => evaluateAerodynamics({
  speed: 5.1,
  altitude,
  angleOfAttackDeg: 2.5 + (loadFactor - 1) * 1.7,
  bankDeg: 0,
  maximumLoadFactor: 7.5,
  stallSpeed: 2.1,
  flightControlHealth: 1,
  performance,
});
const balance = ({ altitude = 20, path = 0, load = 1, thrust = 0.58 } = {}) => {
  const aerodynamics = aero(altitude, load);
  return evaluateLongitudinalForceBalance({
    speed: 5.1,
    altitude,
    flightPathDeg: path,
    loadFactor: load,
    stallSpeed: 2.1,
    maximumSpeed: 11.5,
    baseAcceleration: 1.1,
    baseDrag: 0.018,
    thrustModeFactor: 0.72,
    thrustFraction: thrust,
    aerodynamics,
  });
};

const level = balance();
const hardTurn = balance({ load: 6 });
const climb = balance({ path: 15 });
const descent = balance({ path: -10 });
const highAltitude = balance({ altitude: 100 });
const idle = balance({ thrust: 0.18 });

assert(hardTurn.inducedDragAcceleration > level.inducedDragAcceleration);
assert(hardTurn.netAcceleration < level.netAcceleration);
assert(climb.gravityAcceleration > 0);
assert(climb.netAcceleration < level.netAcceleration);
assert(descent.gravityAcceleration < 0);
assert(descent.netAcceleration > level.netAcceleration);
assert(highAltitude.parasiteDragAcceleration < level.parasiteDragAcceleration);
assert(highAltitude.thrustAcceleration < level.thrustAcceleration);
assert(idle.netAcceleration < 0);
assert(aero(100).availableLoadFactor < aero(20).availableLoadFactor);

console.log(JSON.stringify({ level, hardTurn, climb, descent, highAltitude, idle,
  availableG: { low: aero(20).availableLoadFactor, high: aero(100).availableLoadFactor },
}, null, 2));
