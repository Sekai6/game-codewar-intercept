import assert from "node:assert/strict";
import * as THREE from "three";
import { SpaceWeatherTimelineRuntime } from "../dist-test/space-weather/timeline-runtime.js";
import { SovietGciNetwork } from "../dist-test/soviet-c2/gci-network.js";
import { SovietMaritimeTargetingNetwork } from "../dist-test/soviet-c2/maritime-targeting.js";
import { SovietFleetCommandNetwork } from "../dist-test/soviet-c2/fleet-command.js";
import { AewCommandNetwork } from "../dist-test/air/aew/command-network.js";

const timeline = new SpaceWeatherTimelineRuntime("TOTAL_BAND_DENIAL");
const phases = { nominal: timeline.snapshotAt(0), degrading: timeline.snapshotAt(180), blackout: timeline.snapshotAt(300), recovery: timeline.snapshotAt(1000) };

function runGci(snapshot) {
  const network = new SovietGciNetwork();
  network.reset("ntu-1980s", true); network.setPropagationSnapshot(snapshot);
  const participants = Array.from({length:3},(_,index)=>({id:`mig-${index}`,platformId:"MIG-29A",position:new THREE.Vector3(400+index*8,70,-900),velocity:new THREE.Vector3(0,0,5),alive:true}));
  const targets = [{id:"blue-raid",position:new THREE.Vector3(450,72,-950),velocity:new THREE.Vector3(0,0,-5),radarCrossSection:14,alive:true}];
  for(let time=0;time<=180;time+=1) network.update(time,participants,targets);
  return network.diagnostics(180);
}

function runMaritime(snapshot) {
  const network = new SovietMaritimeTargetingNetwork();
  network.reset("ntu-1980s", true); network.setPropagationSnapshot(snapshot);
  const participants=[{id:"badger-1",platformId:"TU-16K",position:new THREE.Vector3(300,80,-1000),alive:true}];
  const targets=[{id:"blue-group",position:new THREE.Vector3(0,0,0),velocity:new THREE.Vector3(0,0,-.1),radarCrossSection:12000,alive:true}];
  for(let time=0;time<=240;time+=1) network.update(time,participants,targets);
  return network.diagnostics(240);
}

function runFleet(snapshot) {
  const network=new SovietFleetCommandNetwork();
  network.reset("ntu-1980s",true);network.setPropagationSnapshot(snapshot);
  const node={id:"fleet-post",label:"FLEET POST",alive:true,health:1};
  const participants=[{id:"badger-1",platformId:"TU-16K",position:new THREE.Vector3(300,80,-1000),alive:true}];
  for(let time=0;time<=180;time+=1){
    const areas=new Map([["badger-1",{reportTrackId:`area-${Math.floor(time/20)}`,estimatedPosition:new THREE.Vector3(0,0,0),launchRegionCenter:new THREE.Vector3(0,80,-400),quality:.66,observedAt:time,expiresAt:time+30}]]);
    network.update(time,node,participants,areas);
  }
  return network.diagnostics(180);
}

function runAew(snapshot, mode="link4a") {
  const network=new AewCommandNetwork();network.setPropagationSnapshot(snapshot);
  const participants=Array.from({length:4},(_,index)=>({id:`fighter-${index}`,side:mode==="link4a"?"blue":"red",platformId:mode==="link4a"?"F-14A":"MIG-29A",position:new THREE.Vector3(index*10,70,0),alive:true}));
  for(let time=0;time<=120;time+=1){
    const tracks=participants.map((_,index)=>({targetId:`target-${index}`,position:new THREE.Vector3(200+index*20,72,-400),velocity:new THREE.Vector3(0,0,-4),quality:.72,uncertainty:18,lastUpdate:time,classification:"aircraft",source:"local-radar",observationId:`obs-${time}-${index}`}));
    network.update(time,[{id:`${mode}-controller`,side:mode==="link4a"?"blue":"red",position:new THREE.Vector3(),velocity:new THREE.Vector3(),alive:true,mode,controllerCapacity:4,commandDelay:mode==="link4a"?1.2:4.5,commandLife:5,reliability:mode==="link4a"?.94:.78,fighterPlatformIds:[mode==="link4a"?"F-14A":"MIG-29A"],tracks}],participants);
  }
  return network.diagnostics(120);
}

function sample(run){return Object.fromEntries(Object.entries(phases).map(([name,snapshot])=>[name,run(snapshot)]));}
const result={gci:sample(runGci),maritime:sample(runMaritime),fleet:sample(runFleet),link4a:sample(snapshot=>runAew(snapshot,"link4a")),voiceAew:sample(snapshot=>runAew(snapshot,"voice-gci"))};
for(const [name,series] of Object.entries(result)){
  assert.ok(series.nominal.delivered>0,`${name} must deliver in nominal conditions`);
  assert.ok(series.degrading.delivered>0,`${name} must degrade progressively rather than act as an off switch`);
  assert.ok(series.degrading.dropped>0||series.degrading.meanDelay>series.nominal.meanDelay,`${name} must show mid-stage loss or delay`);
  assert.ok(series.blackout.delivered<series.nominal.delivered,`${name} blackout must reduce delivery`);
  assert.ok(series.recovery.delivered>series.blackout.delivered,`${name} recovery must restore some delivery`);
}
const repeat={gci:sample(runGci),maritime:sample(runMaritime),fleet:sample(runFleet),link4a:sample(snapshot=>runAew(snapshot,"link4a")),voiceAew:sample(snapshot=>runAew(snapshot,"voice-gci"))};
assert.deepEqual(result,repeat,"all C2 propagation outcomes must be deterministic for the same message identities and weather snapshots");
console.log(JSON.stringify(result,null,2));
