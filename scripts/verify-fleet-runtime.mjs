import * as THREE from "three";
import { reassessFleetCommand } from "../dist-test/fleet/command-runtime.js";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { updateFleetFormation } from "../dist-test/fleet/formation-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";

const definition = (id, speed, radar = 100) => ({
  id, name:id, hullNumber:id, era:"test", role:"test",
  platform:{maxSpeedKnots:speed,cruiseSpeedKnots:18,patrolSpeedKnots:12,
    accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1.5,turnRateDeg:2,
    decisionInterval:1,standoffRange:1,standoffTolerance:1,significantHeightMeters:20,radarRcs:radar},
  ammo:{rim67:4,sm2mr:12,sm2er:8,ciws:1200,channels:3,illuminators:2},
  surfaceStrike:{magazine:8}, build:()=>new THREE.Group(),
});
const force = createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"], new Map([
  ["long-beach", definition("long-beach", 30)],
  ["ticonderoga", definition("ticonderoga", 32)],
]));
const leader = force.ships.get("blue-cgn-9");
const wing = force.ships.get("blue-cg-57");
if (!leader || !wing) throw new Error("Fleet members missing");

const initialWingPosition = wing.position.clone();
const initialWingHeading = wing.heading;
updateFleetFormation({ force, dt: 1 });
const limitedMotion = wing.position.distanceTo(initialWingPosition) < 1;
const limitedTurn = Math.abs(wing.heading - initialWingHeading) <= THREE.MathUtils.degToRad(2.01);
const independentMotion = !leader.position.equals(wing.position) && leader.velocity !== wing.velocity;
const stationTracked = force.formationState.stations.has(wing.id);

leader.applyDamage(100, leader.position);
const commandChanged = reassessFleetCommand(force, 10);
const successor = force.commandRoles.get("otc");
const anchorFollowed = force.formationState.anchorShipId === wing.id;

const result = { limitedMotion, limitedTurn, independentMotion, stationTracked,
  commandChanged, successor, anchorFollowed };
console.log(JSON.stringify(result, null, 2));
if (!limitedMotion || !limitedTurn || !independentMotion || !stationTracked
    || !commandChanged || successor !== wing.id || !anchorFollowed) process.exitCode = 1;
