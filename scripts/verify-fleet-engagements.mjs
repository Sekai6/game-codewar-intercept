import * as THREE from "three";
import { FleetAirDefenseCoordinator } from "../dist-test/fleet/air-defense-coordinator.js";
import {
  acceptForceAssignment,
  rejectForceAssignment,
  reportForceAssessment,
  reportForceWeaponsAway,
  updateForceEngagements,
} from "../dist-test/fleet/engagement-runtime.js";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";

const definition=(id,kind)=>({id,name:id,hullNumber:id,era:"test",role:"test",
  platform:{maxSpeedKnots:30,cruiseSpeedKnots:18,patrolSpeedKnots:10,accelerationKnotsPerSecond:1,
    decelerationKnotsPerSecond:1,turnRateDeg:2,decisionInterval:1,standoffRange:1,standoffTolerance:1,
    significantHeightMeters:20,radarRcs:10},
  launcher:{kind,displayName:kind,compatibleWeapons:kind==="mk10"?["RIM-67"]:["SM-2MR","SM-2ER"],
    ...(kind==="mk10"?{azimuthRateDeg:20,elevationRateDeg:10,reloadSeconds:8}
      :{columns:8,sequenceInterval:.5,exhaustClearance:1,isolationStartsAt:1,maximumIsolationFraction:.2,
        loadingPermutation:1,gridSize:8})},sensors:[],
  ammo:{rim67:8,sm2mr:12,sm2er:8,ciws:1000,channels:3,illuminators:2},
  subsystemLabels:{},subsystemPositions:{},damageModel:{longitudinalLimit:1,zones:[]},build:()=>new THREE.Group()});
const createForce=()=>createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"],new Map([
  ["long-beach",definition("long-beach","mk10")],["ticonderoga",definition("ticonderoga","mk41")],
]));
const track=(id)=>({targetId:id,position:new THREE.Vector3(-170,12,-190),velocity:new THREE.Vector3(0,0,2.2),
  quality:.78,uncertainty:220,classification:"missile",source:"local-radar",updatedAt:0,weaponQuality:true});
const prepare=()=>{const force=createForce(),otc=force.ships.get("blue-cgn-9"),picket=force.ships.get("blue-cg-57");
  if(!otc||!picket)throw new Error("Fleet members missing");const cue=track("THREAT-1");
  force.picture.set(cue.targetId,{...cue,weaponQuality:false});otc.localTracks.set(cue.targetId,track(cue.targetId));
  picket.localTracks.set(cue.targetId,track(cue.targetId));return{force,otc,picket};};

const coordinator=new FleetAirDefenseCoordinator();
const firstCase=prepare();
coordinator.update(firstCase.force,1);
const first=[...firstCase.force.assignments.values()][0];
coordinator.update(firstCase.force,2);
const duplicateSuppressed=firstCase.force.assignments.size===1&&firstCase.force.engagements.size===1;
const ammoBefore=firstCase.picket.magazines.rounds.get("SM-2MR");
const foreignAcceptanceBlocked=!acceptForceAssignment(firstCase.force,first.id,"blue-cgn-9",2.4);
const accepted=acceptForceAssignment(firstCase.force,first.id,first.shooterId,2.5);
const acceptDoesNotConsume=firstCase.picket.magazines.rounds.get("SM-2MR")===ammoBefore
  &&firstCase.picket.engagements.size===0;
const foreignWeaponsAwayBlocked=!reportForceWeaponsAway(firstCase.force,{assignmentId:first.id,
  shooterId:"blue-cgn-9",count:2,estimatedSingleShotPk:.55,expectedInterceptTimes:[10,12],now:2.8});
const weaponsAway=reportForceWeaponsAway(firstCase.force,{assignmentId:first.id,shooterId:first.shooterId,count:2,
  estimatedSingleShotPk:.55,expectedInterceptTimes:[10,12],now:3});
coordinator.update(firstCase.force,8);
const lookSuppresses=firstCase.force.assignments.size===1;
updateForceEngagements(firstCase.force,12);
const assessing=firstCase.force.engagements.get("THREAT-1")?.status==="assessing";
coordinator.update(firstCase.force,12);
const assessmentSuppresses=firstCase.force.assignments.size===1;
firstCase.picket.magazines.rounds.set("SM-2MR",0);firstCase.picket.magazines.rounds.set("SM-2ER",0);
updateForceEngagements(firstCase.force,18.1);coordinator.update(firstCase.force,18.1);
const followup=[...firstCase.force.assignments.values()].at(-1);
const leakerReassigned=firstCase.force.assignments.size===2&&followup?.shooterId==="blue-cgn-9";
const forceRecord=firstCase.force.engagements.get("THREAT-1");
const salvoRecorded=forceRecord?.weaponsCommitted===2&&Math.abs((forceRecord?.estimatedPk??0)-.7975)<.0001;
reportForceAssessment(firstCase.force,"THREAT-1","kill",19);
coordinator.update(firstCase.force,30);
const resolvedSuppresses=firstCase.force.assignments.size===2
  &&firstCase.force.engagements.get("THREAT-1")?.status==="resolved";

const rejectCase=prepare();const rejectCoordinator=new FleetAirDefenseCoordinator();rejectCoordinator.update(rejectCase.force,1);
const rejected=[...rejectCase.force.assignments.values()][0];
rejectCase.picket.magazines.rounds.set("SM-2MR",0);rejectCase.picket.magazines.rounds.set("SM-2ER",0);
const rejectedOk=rejectForceAssignment(rejectCase.force,rejected.id,rejected.shooterId,"LOCAL LAUNCHER UNAVAILABLE",2);
rejectCoordinator.update(rejectCase.force,2.1);
const rejectionTransferred=[...rejectCase.force.assignments.values()].at(-1)?.shooterId==="blue-cgn-9";

const expiryCase=prepare();const expiryCoordinator=new FleetAirDefenseCoordinator();expiryCoordinator.update(expiryCase.force,1);
const expiring=[...expiryCase.force.assignments.values()][0];updateForceEngagements(expiryCase.force,expiring.expiresAt);
const expiryReopens=expiring.status==="expired"&&expiryCase.force.engagements.get("THREAT-1")?.status==="leaker";

const result={duplicateSuppressed,foreignAcceptanceBlocked,accepted,acceptDoesNotConsume,
  foreignWeaponsAwayBlocked,weaponsAway,lookSuppresses,assessing,
  assessmentSuppresses,salvoRecorded,leakerReassigned,resolvedSuppresses,rejectedOk,rejectionTransferred,expiryReopens,
  forceRecord:`${forceRecord?.status}/${forceRecord?.weaponsCommitted}/${forceRecord?.estimatedPk.toFixed(4)}`};
console.log(JSON.stringify(result,null,2));
if(Object.entries(result).some(([key,value])=>key!=="forceRecord"&&value!==true))process.exitCode=1;
