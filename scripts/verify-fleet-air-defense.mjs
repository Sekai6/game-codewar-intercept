import * as THREE from "three";
import { FleetAirDefenseCoordinator } from "../dist-test/fleet/air-defense-coordinator.js";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";

const definition = (id, launcher) => ({
  id,name:id,hullNumber:id,era:"test",role:"test",
  platform:{maxSpeedKnots:30,cruiseSpeedKnots:18,patrolSpeedKnots:10,
    accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1,turnRateDeg:2,
    decisionInterval:1,standoffRange:1,standoffTolerance:1,significantHeightMeters:20,radarRcs:10},
  launcher:{kind:launcher,displayName:launcher,compatibleWeapons:launcher==="mk10"?["RIM-67"]:["SM-2MR","SM-2ER"],
    ...(launcher==="mk10"?{azimuthRateDeg:20,elevationRateDeg:10,reloadSeconds:8}
      :{columns:8,sequenceInterval:.5,exhaustClearance:1,isolationStartsAt:1,maximumIsolationFraction:.2,loadingPermutation:1,gridSize:8})},
  sensors:[],ammo:{rim67:8,sm2mr:12,sm2er:8,ciws:1000,channels:3,illuminators:2},
  subsystemLabels:{},subsystemPositions:{},damageModel:{longitudinalLimit:1,zones:[]},
  build:()=>new THREE.Group(),
});
const createForce=()=>createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"],new Map([
  ["long-beach",definition("long-beach","mk10")],
  ["ticonderoga",definition("ticonderoga","mk41")],
]));
const track=(id,source="local-radar",weaponQuality=true)=>({
  targetId:id,position:new THREE.Vector3(-170,12,-190),velocity:new THREE.Vector3(0,0,2.2),
  quality:.78,uncertainty:260,classification:"missile",source,updatedAt:0,weaponQuality,
});

const coordinator=new FleetAirDefenseCoordinator();
const force=createForce(),otc=force.ships.get("blue-cgn-9"),picket=force.ships.get("blue-cg-57");
if(!otc||!picket)throw new Error("Fleet members missing");
force.picture.set("FJ-THREAT",track("FJ-THREAT","link11",false));
coordinator.update(force,1);
const cueOnlyBlocked=force.assignments.size===0;
picket.localTracks.set("LOCAL-M1",track("LOCAL-M1"));
const ammoBefore=picket.magazines.rounds.get("SM-2MR");
coordinator.update(force,2);
const first=[...force.assignments.values()][0];
const localShooterSelected=first?.shooterId==="blue-cg-57"&&first.localTrackId==="LOCAL-M1";
const noResourceMutation=picket.magazines.rounds.get("SM-2MR")===ammoBefore
  &&picket.engagements.size===0&&otc.engagements.size===0;

coordinator.reset(force);
picket.magazines.rounds.set("SM-2MR",0);
picket.magazines.rounds.set("SM-2ER",0);
otc.localTracks.set("LOCAL-M1-OTC",track("LOCAL-M1-OTC"));
coordinator.update(force,3);
const reassigned=[...force.assignments.values()][0];
const depletedShooterBypassed=reassigned?.shooterId==="blue-cgn-9"&&reassigned.weapon==="RIM-67";
const result={cueOnlyBlocked,localShooterSelected,noResourceMutation,depletedShooterBypassed,
  first:first?`${first.shooterId}/${first.weapon}/${first.requestedShots}`:null,
  reassigned:reassigned?`${reassigned.shooterId}/${reassigned.weapon}`:null};
console.log(JSON.stringify(result,null,2));
if(!cueOnlyBlocked||!localShooterSelected||!noResourceMutation||!depletedShooterBypassed)process.exitCode=1;
