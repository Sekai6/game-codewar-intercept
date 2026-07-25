import * as THREE from "three";
import { AEW_PLATFORM_DEFINITIONS } from "../dist-test/air/aew/catalog.js";
import { aewOrbitDirection } from "../dist-test/air/aew/mission.js";
import { AewCommandNetwork } from "../dist-test/air/aew/command-network.js";

const byId=Object.fromEntries(AEW_PLATFORM_DEFINITIONS.map(definition=>[definition.id,definition]));
const models=AEW_PLATFORM_DEFINITIONS.map(definition=>{
  const model=definition.buildModel(); let meshes=0; model.traverse(object=>{if(object.isMesh)meshes++;});
  return {id:definition.id,meshes,length:model.userData.modelLength,tags:model.userData.detailTags,propellers:model.userData.propellers?.length??0,rotodome:!!model.userData.rotodome};
});
const station=new THREE.Vector3(0,90,0),position=new THREE.Vector3(90,90,0);
const orbit=aewOrbitDirection({position,station,clockwise:true,radius:75});
const network=new AewCommandNetwork();
const track={targetId:"secret-target-entity",position:new THREE.Vector3(100,70,0),velocity:new THREE.Vector3(0,0,4),quality:.72,uncertainty:14,lastUpdate:0,classification:"aircraft",observationId:"sensor-observation-1"};
const nodes=[{id:"blue-e2",side:"blue",position:new THREE.Vector3(),velocity:new THREE.Vector3(),alive:true,mode:"link4a",controllerCapacity:2,commandDelay:1.2,commandLife:10,reliability:.94,fighterPlatformIds:["F-14A"],tracks:[track]},{id:"red-tu126",side:"red",position:new THREE.Vector3(),velocity:new THREE.Vector3(),alive:true,mode:"voice-gci",controllerCapacity:1,commandDelay:4.5,commandLife:16,reliability:.78,fighterPlatformIds:["MIG-29A"],tracks:[track]}];
const participants=[{id:"f14-1",side:"blue",platformId:"F-14A",position:new THREE.Vector3(),alive:true},{id:"f14-2",side:"blue",platformId:"F-14A",position:new THREE.Vector3(),alive:true},{id:"mig-1",side:"red",platformId:"MIG-29A",position:new THREE.Vector3(),alive:true},{id:"mig-2",side:"red",platformId:"MIG-29A",position:new THREE.Vector3(),alive:true}];
network.update(0,nodes,participants); const beforeDelivery=network.active(1).length;
network.update(2,nodes,participants); const link4=network.active(2);
network.update(5,nodes,participants); const commands=network.active(5);
const result={models,platforms:AEW_PLATFORM_DEFINITIONS.map(definition=>({id:definition.id,mission:definition.mission,coverage:definition.sensor.coverage,fov:definition.sensor.fieldOfViewDeg,range:definition.sensor.range,ammo:Object.values(definition.loadout).reduce((sum,count)=>sum+count,0),hardpoints:definition.hardpoints.length})),orbit:{x:orbit.x,y:orbit.y,z:orbit.z},network:{beforeDelivery,link4:link4.map(command=>command.participantId),commands:commands.map(command=>({participantId:command.participantId,mode:command.mode,track:command.controllerTrackId,hasTruthId:Object.hasOwn(command,"targetId")}))}};
console.log(JSON.stringify(result,null,2));
if(!byId["E-2C"]||!byId["TU-126"]||byId["TU-126"].radarCrossSection<=byId["E-2C"].radarCrossSection*5||models.some(model=>!model.rotodome||model.meshes<12)||models.find(model=>model.id==="E-2C")?.propellers!==2||models.find(model=>model.id==="TU-126")?.propellers!==4||result.platforms.some(platform=>platform.mission!=="aew"||platform.coverage!=="rotating-360"||platform.fov!==360||platform.ammo!==0||platform.hardpoints!==0)||orbit.z<.7||orbit.x>-.05||beforeDelivery!==0||link4.length!==1||commands.filter(command=>command.mode==="link4a").length!==2||commands.filter(command=>command.mode==="voice-gci").length!==1||commands.some(command=>command.controllerTrackId.includes("secret-target")||Object.hasOwn(command,"targetId")))process.exitCode=1;
