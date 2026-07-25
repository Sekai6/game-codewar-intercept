import * as THREE from "three";
import { AEW_PLATFORM_DEFINITIONS } from "../dist-test/air/aew/catalog.js";
import { aewOrbitDirection } from "../dist-test/air/aew/mission.js";

const byId=Object.fromEntries(AEW_PLATFORM_DEFINITIONS.map(definition=>[definition.id,definition]));
const models=AEW_PLATFORM_DEFINITIONS.map(definition=>{
  const model=definition.buildModel(); let meshes=0; model.traverse(object=>{if(object.isMesh)meshes++;});
  return {id:definition.id,meshes,length:model.userData.modelLength,tags:model.userData.detailTags,propellers:model.userData.propellers?.length??0,rotodome:!!model.userData.rotodome};
});
const station=new THREE.Vector3(0,90,0),position=new THREE.Vector3(90,90,0);
const orbit=aewOrbitDirection({position,station,clockwise:true,radius:75});
const result={models,platforms:AEW_PLATFORM_DEFINITIONS.map(definition=>({id:definition.id,mission:definition.mission,coverage:definition.sensor.coverage,fov:definition.sensor.fieldOfViewDeg,range:definition.sensor.range,ammo:Object.values(definition.loadout).reduce((sum,count)=>sum+count,0),hardpoints:definition.hardpoints.length})),orbit:{x:orbit.x,y:orbit.y,z:orbit.z}};
console.log(JSON.stringify(result,null,2));
if(!byId["E-2C"]||!byId["TU-126"]||byId["TU-126"].radarCrossSection<=byId["E-2C"].radarCrossSection*5||models.some(model=>!model.rotodome||model.meshes<12)||models.find(model=>model.id==="E-2C")?.propellers!==2||models.find(model=>model.id==="TU-126")?.propellers!==4||result.platforms.some(platform=>platform.mission!=="aew"||platform.coverage!=="rotating-360"||platform.fov!==360||platform.ammo!==0||platform.hardpoints!==0)||orbit.z<.7||orbit.x>-.05)process.exitCode=1;
