import * as THREE from "three";
import {
  calculateDynamicLaunchZone,
  dynamicShotAllowed,
} from "../dist-test/air/ai/weapon-employment.js";
import { planBvrManeuver } from "../dist-test/air/ai/tactical-planner.js";

const weapon = {
  minRange: 10,
  maxRange: 400,
  speed: 18,
};
const track = (position, velocity, quality = 0.8, uncertainty = 8) => ({
  targetId: "TRACK-17",
  position,
  velocity,
  quality,
  uncertainty,
  lastUpdate: 0,
  classification: "aircraft",
});
const hotTrack = track(
  new THREE.Vector3(0, 55, -250),
  new THREE.Vector3(0, 0, 5),
);
const coldTrack = track(
  new THREE.Vector3(0, 55, -250),
  new THREE.Vector3(0, 0, -5),
);
const zone = targetTrack => calculateDynamicLaunchZone({
  weapon,
  shooterPosition: new THREE.Vector3(0, 85, 0),
  shooterVelocity: new THREE.Vector3(0, 0, -8),
  shooterMaximumSpeed: 11,
  track: targetTrack,
});
const hot = zone(hotTrack);
const cold = zone(coldTrack);
const crank = planBvrManeuver({
  ownPosition: new THREE.Vector3(),
  currentHeading: new THREE.Vector3(0, 0, -1),
  formationSide: 1,
  targetTrack: hotTrack,
  supportingWeapon: { seekerAcquired: false, guidance: "active-radar" },
});
const pump = planBvrManeuver({
  ownPosition: new THREE.Vector3(),
  currentHeading: new THREE.Vector3(0, 0, -1),
  formationSide: 1,
  targetTrack: hotTrack,
  supportingWeapon: { seekerAcquired: true, guidance: "active-radar" },
});
const warning = track(
  new THREE.Vector3(0, 1, -40),
  new THREE.Vector3(0, 0, 12),
);
const notch = planBvrManeuver({
  ownPosition: new THREE.Vector3(),
  currentHeading: new THREE.Vector3(0, 0, -1),
  formationSide: -1,
  warningTrack: warning,
  warningTti: 14,
});
const drag = planBvrManeuver({
  ownPosition: new THREE.Vector3(),
  currentHeading: new THREE.Vector3(0, 0, -1),
  formationSide: -1,
  warningTrack: warning,
  warningTti: 6,
});
const result = {
  hot,
  cold,
  hotAllowed: dynamicShotAllowed({ zone: hot, defensive: false }),
  modes: [crank.mode, pump.mode, notch.mode, drag.mode],
  crankDirection: crank.desiredDirection.toArray(),
  notchDot: new THREE.Vector3(0, 0, 12).normalize()
    .dot(notch.desiredDirection.clone().setY(0).normalize()),
  dragAwayDot: new THREE.Vector3(0, 0, 1)
    .dot(drag.desiredDirection.clone().setY(0).normalize()),
};
console.log(JSON.stringify(result, null, 2));
if (
  !(hot.rMax > cold.rMax) ||
  !(hot.rMin < hot.rNe && hot.rNe < hot.rTr && hot.rTr < hot.rMax) ||
  !result.hotAllowed ||
  result.modes.join(",") !== "crank,pump,notch,drag" ||
  Math.abs(result.notchDot) > 0.05 ||
  result.dragAwayDot < 0.9
) process.exitCode = 1;
