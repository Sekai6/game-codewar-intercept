import { calculateFireControlUsage, chooseAirWeapon } from "../dist-test/air/launch-management.js";
import { advanceCountermeasurePrograms } from "../dist-test/air/countermeasure-program.js";
import * as THREE from "three";

const usage=calculateFireControlUsage({
  liveWeapons:[
    {guidance:"active-radar",seekerAcquired:false},
    {guidance:"active-radar",seekerAcquired:true},
    {guidance:"semi-active-radar",seekerAcquired:false},
  ],
  pendingWeapons:[
    {guidance:"anti-ship-radar"},
    {guidance:"semi-active-radar"},
  ],
});
const programs=[{type:"chaff",remaining:3,nextReleaseAt:10,interval:.2}];
const inventory={chaff:3,flares:2};
const first=advanceCountermeasurePrograms(programs,inventory,10);
const firstSnapshot={releaseCount:first.releases.length,chaff:first.inventory.chaff};
const early=advanceCountermeasurePrograms(first.programs,first.inventory,10.1);
const earlySnapshot={releaseCount:early.releases.length,chaff:early.inventory.chaff};
const second=advanceCountermeasurePrograms(early.programs,early.inventory,10.2);
const secondSnapshot={releaseCount:second.releases.length,chaff:second.inventory.chaff};
const weaponCatalog={
  "R-27R":{id:"R-27R",targets:["aircraft"],guidance:"semi-active-radar",minRange:6,maxRange:240,speed:18},
  "R-73":{id:"R-73",targets:["aircraft"],guidance:"infrared",minRange:1.5,maxRange:65,speed:12},
};
const aircraft={
  ammo:new Map([["R-27R",2],["R-73",2]]),
  position:new THREE.Vector3(),
  velocity:new THREE.Vector3(0,0,-5),
  definition:{fireControlChannels:{datalink:0,illumination:1},flight:{maxSpeed:10}},
  hardpoints:[
    {state:"ready",weaponId:"R-27R"},
    {state:"ready",weaponId:"R-73"},
  ],
};
const normalWeapon=chooseAirWeapon({aircraft,missiles:[],classification:"aircraft",range:50,weaponCatalog});
const defensiveWeapon=chooseAirWeapon({aircraft,missiles:[],classification:"aircraft",range:50,weaponCatalog,defensive:true});
const closeTrack={position:new THREE.Vector3(0,0,-30),velocity:new THREE.Vector3(0,0,-4),quality:.8,uncertainty:1};
const advancedCloseWeapon=chooseAirWeapon({aircraft,missiles:[],classification:"aircraft",range:30,track:closeTrack,advancedAi:true,weaponCatalog});
const result={usage,first:firstSnapshot,early:earlySnapshot,second:secondSnapshot,normalWeapon:normalWeapon?.id,defensiveWeapon:defensiveWeapon?.id,advancedCloseWeapon:advancedCloseWeapon?.id};
console.log(JSON.stringify(result,null,2));
if(usage.datalink!==2||usage.illumination!==2||firstSnapshot.releaseCount!==1||firstSnapshot.chaff!==2||earlySnapshot.releaseCount!==0||secondSnapshot.releaseCount!==1||secondSnapshot.chaff!==1||normalWeapon?.id!=="R-27R"||defensiveWeapon?.id!=="R-73"||advancedCloseWeapon?.id!=="R-73")process.exitCode=1;
