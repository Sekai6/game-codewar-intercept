import assert from "node:assert/strict";
import * as THREE from "three";
import { createShipCombatant } from "../dist-test/ships/ship-runtime.js";
import { ShipDamageControlRuntime } from "../dist-test/ships/damage-control-runtime.js";

const systems = ["primaryRadar","secondaryRadar","fireControl","aftLauncher","forwardLauncher","ciws","ecm","srboc","propulsion"];
const definition = {
  id:"test",name:"test",hullNumber:"test",era:"test",role:"test",
  platform:{maxSpeedKnots:30,cruiseSpeedKnots:18,patrolSpeedKnots:12,accelerationKnotsPerSecond:1,decelerationKnotsPerSecond:1,turnRateDeg:2,decisionInterval:1,standoffRange:100,standoffTolerance:10,significantHeightMeters:20,radarRcs:100},
  launcher:{kind:"mk41",displayName:"Mk 41",compatibleWeapons:["SM-2MR"],columns:2,sequenceInterval:.2,exhaustClearance:2,isolationStartsAt:.5,maximumIsolationFraction:.5,loadingPermutation:1,gridSize:2},
  sensors:[],subsystemLabels:Object.fromEntries(systems.map(x=>[x,x])),subsystemPositions:Object.fromEntries(systems.map(x=>[x,new THREE.Vector3()])),
  damageModel:{longitudinalLimit:20,zones:[{minX:5,systems:["primaryRadar","fireControl"]},{minX:-Infinity,systems:["propulsion","aftLauncher"]}]},
  ammo:{rim67:0,sm2mr:8,sm2er:0,ciws:1000,channels:2,illuminators:2},hullColor:0x777777,build:()=>new THREE.Group(),
};
const runtime = new ShipDamageControlRuntime();
const ship = createShipCombatant({id:"damaged",forceId:"blue",side:"blue",definition,position:new THREE.Vector3(),heading:0});
ship.commandedSpeedKnots=30;
runtime.applyImpact(ship,70,new THREE.Vector3(10,0,0),1);
assert.ok(ship.subsystemHealth.get("primaryRadar")<50);
assert.ok(ship.damageControl.fireIntensity>0&&ship.damageControl.flooding>0);
for(let i=0;i<60;i++)runtime.update(ship,2+i,1);
assert.ok(ship.hullIntegrity<50);
assert.ok(runtime.diagnostics().some(event=>event.kind==="impact"));
runtime.applyImpact(ship,200,new THREE.Vector3(-10,0,0),70);
assert.equal(ship.alive,false);
console.log(JSON.stringify({zonalDamage:true,progressiveDamage:true,disablement:true,events:runtime.diagnostics().length}));
