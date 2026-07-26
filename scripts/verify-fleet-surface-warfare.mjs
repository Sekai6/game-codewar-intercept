import assert from "node:assert/strict";
import * as THREE from "three";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { FleetSurfaceWarfareCoordinator } from "../dist-test/fleet/surface-warfare-coordinator.js";

const def = (id) => ({ id, name:id, hullNumber:id, era:"test", role:"test",
  platform:{maxSpeedKnots:30,cruiseSpeedKnots:18,patrolSpeedKnots:12,accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1,turnRateDeg:2,decisionInterval:1,standoffRange:100,standoffTolerance:10,significantHeightMeters:20,radarRcs:10},
  launcher:{kind:"mk10",displayName:"Mk 10",compatibleWeapons:["RIM-67"],azimuthRateDeg:50,elevationRateDeg:25,reloadSeconds:1},sensors:[],subsystemLabels:{},subsystemPositions:{},damageModel:{longitudinalLimit:20,zones:[]},ammo:{rim67:0,sm2mr:0,sm2er:0,ciws:100,channels:1,illuminators:1},surfaceStrike:{weapon:"RGM-84 Harpoon",displayName:"Harpoon",magazine:4,minimumInterval:1,minRange:10,maxRange:500,requiredTrackQuality:.6,maximumTrackAge:4,minimumTrackAge:1,fireControlDelay:1,datalinkUpdateInterval:1,datalinkLatency:.5,datalinkMinimumQuality:.2,routeLateralOffset:1,routeJoinRange:10,arrivalWindow:1,maximumSpeedCompensation:.2,damage:34,fuseDelay:.2,salvoSize:4,minimumSalvoSize:2,maximumWeaponsInFlight:4,assessmentDelay:2,expectedLeakProbability:.4,targetHullEstimate:100},build:()=>new THREE.Group() });
const scenario={id:"surface",label:"surface",side:"blue",doctrineId:"us-ntu-link11",datalinkEra:"ntu-baseline",formation:"screen",ships:[{instanceId:"asuwc",definitionId:"test",position:[0,0,0],heading:0,formationRole:"picket",commandRoles:["otc","asuwc"]}]};
const force=createNavalForceRuntime(scenario,new Map([["test",def("test")]]));
const ship=force.ships.get("asuwc");
ship.localTracks.set("red-cruiser",{targetId:"red-cruiser",position:new THREE.Vector3(120,0,0),velocity:new THREE.Vector3(),quality:.86,uncertainty:10,classification:"ship",source:"local-radar",updatedAt:1,weaponQuality:true});
force.picture.set("red-cruiser",ship.localTracks.get("red-cruiser"));
const runtime=new FleetSurfaceWarfareCoordinator(); runtime.update(force,2);
const assignment=[...force.surfaceAssignments.values()][0];
assert.ok(assignment); assert.equal(assignment.shooterId,"asuwc"); assert.equal(assignment.status,"assigned"); assert.equal(ship.magazines.surfaceStrike,4);
console.log(JSON.stringify({assignmentCreated:true,localTrackRequired:true,magazineUntouched:true,id:assignment.id}));
