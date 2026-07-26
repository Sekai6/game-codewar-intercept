import * as THREE from "three";
import { reassessFleetCommand } from "../dist-test/fleet/command-runtime.js";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { updateFleetFormation } from "../dist-test/fleet/formation-runtime.js";
import { NAVAL_FORCE_SCENARIOS, blueNtuScreenForFlagship } from "../dist-test/fleet/scenarios.js";
import { ShipSensorRuntime } from "../dist-test/ships/sensor-runtime.js";

const definition = (id, speed, radar = 100) => ({
  id, name:id, hullNumber:id, era:"test", role:"test",
  platform:{maxSpeedKnots:speed,cruiseSpeedKnots:18,patrolSpeedKnots:12,
    accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1.5,turnRateDeg:2,
    decisionInterval:1,standoffRange:1,standoffTolerance:1,significantHeightMeters:20,radarRcs:radar},
  sensors:[
    {name:"TEST-3D",threeDimensional:true,baseInterval:.5,maxRange:650,radarHeight:30,precision:1},
    {name:"TEST-2D",threeDimensional:false,baseInterval:.8,maxRange:900,radarHeight:35,precision:.8},
  ],
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

const sensorRuntime = new ShipSensorRuntime();
const hostile = {
  id:"hostile-air-1",side:"red",kind:"aircraft",
  position:new THREE.Vector3(0, 30, -120),velocity:new THREE.Vector3(),
  radarCrossSection:8,infraredSignature:1,alive:true,applyDamage:()=>{},
};
wing.subsystemHealth.set("primaryRadar", 0);
wing.subsystemHealth.set("secondaryRadar", 0);
for (let step = 1; step <= 40; step++) {
  sensorRuntime.update(leader, step * .25, .25, [{ entity: hostile, altitudeMeters: 6000 }]);
  sensorRuntime.update(wing, step * .25, .25, [{ entity: hostile, altitudeMeters: 6000 }]);
}
const independentSensors = leader.localTracks.has(hostile.id) && wing.localTracks.size === 0;

leader.applyDamage(100, leader.position);
const commandChanged = reassessFleetCommand(force, 10);
const successor = force.commandRoles.get("otc");
const anchorFollowed = force.formationState.anchorShipId === wing.id;
const swappedForce = createNavalForceRuntime(
  blueNtuScreenForFlagship("ticonderoga"),
  new Map([
    ["long-beach", definition("long-beach", 30)],
    ["ticonderoga", definition("ticonderoga", 32)],
  ]),
);
const selectableFlagship = swappedForce.commandRoles.get("otc") === "blue-cg-57"
  && swappedForce.ships.size === 2;

const result = { limitedMotion, limitedTurn, independentMotion, stationTracked,
  independentSensors, commandChanged, successor, anchorFollowed, selectableFlagship };
console.log(JSON.stringify(result, null, 2));
if (!limitedMotion || !limitedTurn || !independentMotion || !stationTracked || !independentSensors || !selectableFlagship
    || !commandChanged || successor !== wing.id || !anchorFollowed) process.exitCode = 1;
