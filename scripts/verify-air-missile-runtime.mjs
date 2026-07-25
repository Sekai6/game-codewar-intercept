import * as THREE from "three";
import {
  airToAirGuidancePoint,
  airToAirMidcourseAimPoint,
  airToAirMissilePhase,
  stepAirToAirPropulsion,
  shouldContinueAfterTargetLoss,
} from "../dist-test/missile-runtime.js";

const commandPoint = new THREE.Vector3(100, 20, 0);
const truth = new THREE.Vector3(80, 25, 10);
const phases = [
  airToAirMissilePhase({ age: 1, boostSeconds: 3, commandRange: 20, seekerRange: 40, seekerAcquired: false }),
  airToAirMissilePhase({ age: 4, boostSeconds: 3, commandRange: 60, seekerRange: 40, seekerAcquired: false }),
  airToAirMissilePhase({ age: 4, boostSeconds: 3, commandRange: 30, seekerRange: 40, seekerAcquired: false }),
];
const preCapture = airToAirGuidancePoint({ seekerAcquired: false, commandPoint, measuredTargetPosition: truth });
const postCapture = airToAirGuidancePoint({ seekerAcquired: true, commandPoint, measuredTargetPosition: truth });
const lostTarget = {
  continues: shouldContinueAfterTargetLoss({ age: 20, maximumAge: 180, altitude: 4 }),
  expires: shouldContinueAfterTargetLoss({ age: 181, maximumAge: 180, altitude: 4 }),
};
const lofted = airToAirMidcourseAimPoint({commandPoint:new THREE.Vector3(1000,70,0),missilePosition:new THREE.Vector3(0,70,0),seekerAcquired:false,loftAltitude:210,loftTransitionRange:360});
const descending = airToAirMidcourseAimPoint({commandPoint:new THREE.Vector3(1000,70,0),missilePosition:new THREE.Vector3(800,180,0),seekerAcquired:false,loftAltitude:210,loftTransitionRange:360});
const boostSpeed = stepAirToAirPropulsion({currentSpeed:8,nominalSpeed:19,age:2,boostSeconds:6,sustainSeconds:24,coastDragPerSecond:.009,minimumSpeedFactor:.38,dt:1});
const sustainSpeed = stepAirToAirPropulsion({currentSpeed:18,nominalSpeed:19,age:12,boostSeconds:6,sustainSeconds:24,coastDragPerSecond:.009,minimumSpeedFactor:.38,dt:1});
const coastSpeed = stepAirToAirPropulsion({currentSpeed:17,nominalSpeed:19,age:40,boostSeconds:6,sustainSeconds:24,coastDragPerSecond:.009,minimumSpeedFactor:.38,dt:1});

console.log(JSON.stringify({ phases, preCapture: preCapture.toArray(), postCapture: postCapture.toArray(), lostTarget, loftedAltitude:lofted.y, descendingAltitude:descending.y, boostSpeed, sustainSpeed, coastSpeed }, null, 2));
if (
  phases.join(",") !== "boost,midcourse,terminal" ||
  !preCapture.equals(commandPoint) ||
  !postCapture.equals(truth) ||
  !lostTarget.continues ||
  lostTarget.expires ||
  lofted.y <= 70 || descending.y >= lofted.y ||
  boostSpeed <= 8 || sustainSpeed <= 17 || coastSpeed >= 17
) process.exitCode = 1;
