import * as THREE from "three";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { FleetLink11Runtime } from "../dist-test/fleet/link11-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";

const definition = (id) => ({
  id,name:id,hullNumber:id,era:"test",role:"test",
  platform:{maxSpeedKnots:30,cruiseSpeedKnots:18,patrolSpeedKnots:10,
    accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1,turnRateDeg:2,
    decisionInterval:1,standoffRange:1,standoffTolerance:1,significantHeightMeters:20,radarRcs:10},
  sensors:[],ammo:{rim67:4,sm2mr:12,sm2er:8,ciws:1000,channels:3,illuminators:2},
  surfaceStrike:{magazine:8},build:()=>new THREE.Group(),
});
const force = createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"], new Map([
  ["long-beach",definition("long-beach")],["ticonderoga",definition("ticonderoga")],
]));
const otc=force.ships.get("blue-cgn-9"), picket=force.ships.get("blue-cg-57");
if(!otc||!picket)throw new Error("Fleet members missing");
picket.localTracks.set("truth-hostile-1",{
  targetId:"truth-hostile-1",position:new THREE.Vector3(100,20,-80),velocity:new THREE.Vector3(-1,0,0),
  quality:.82,uncertainty:420,classification:"missile",source:"local-radar",updatedAt:0,weaponQuality:true,
});
const runtime=new FleetLink11Runtime();
for(let time=0;time<=16;time+=.25)runtime.update(force,time,true);
const received=[...otc.networkTracks.values()];
const result={
  received:received.length,
  anonymous:received.every(track=>!track.targetId.includes("truth-hostile-1")),
  cueOnly:received.every(track=>!track.weaponQuality),
  localAuthorityPreserved:picket.localTracks.get("truth-hostile-1")?.weaponQuality===true,
  forcePicture:force.picture.size,
  forcePictureCueOnly:[...force.picture.values()].every(track=>!track.weaponQuality),
  ncs:runtime.diagnostics().netControlStation,
  delivered:runtime.diagnostics().delivered,
};
runtime.update(force,17,false);
result.disabledClears=otc.networkTracks.size===0&&force.picture.size===0;

const recoveryForce = createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"], new Map([
  ["long-beach",definition("long-beach")],["ticonderoga",definition("ticonderoga")],
]));
const recoveryOtc=recoveryForce.ships.get("blue-cgn-9"), recoveryPicket=recoveryForce.ships.get("blue-cg-57");
if(!recoveryOtc||!recoveryPicket)throw new Error("Recovery fleet members missing");
recoveryPicket.localTracks.set("blackout-contact",{
  targetId:"blackout-contact",position:new THREE.Vector3(120,24,-100),velocity:new THREE.Vector3(-1,0,0),
  quality:.7,uncertainty:650,classification:"aircraft",source:"local-radar",updatedAt:2,weaponQuality:true,
});
recoveryForce.shipComms.set(recoveryPicket.id,{connected:false,doctrineBehavior:"local-defense",changedAt:0});
const recoveryRuntime=new FleetLink11Runtime();
for(let time=0;time<=8;time+=.25)recoveryRuntime.update(recoveryForce,time,true);
const deliveredBeforeRestore=recoveryRuntime.diagnostics().delivered;
recoveryForce.shipComms.set(recoveryPicket.id,{connected:true,doctrineBehavior:"networked",changedAt:8.25});
for(let time=8.25;time<=24;time+=.25)recoveryRuntime.update(recoveryForce,time,true);
result.deferredRequeued=deliveredBeforeRestore===0&&recoveryRuntime.diagnostics().delivered>0;
result.deferredCueOnly=[...recoveryOtc.networkTracks.values()].every(track=>!track.weaponQuality);
console.log(JSON.stringify(result,null,2));
if(!result.received||!result.anonymous||!result.cueOnly||!result.localAuthorityPreserved
  ||!result.forcePicture||!result.forcePictureCueOnly||result.ncs!=="blue-cgn-9"
  ||!result.delivered||!result.disabledClears||!result.deferredRequeued||!result.deferredCueOnly)process.exitCode=1;
