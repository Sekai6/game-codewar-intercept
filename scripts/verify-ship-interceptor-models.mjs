import * as THREE from "three";
import { createShipInterceptorModel } from "../dist-test/models/ship-interceptors.js";

const result=["RIM-67","SM-2MR","SM-2ER"].map((weapon)=>{
  const model=createShipInterceptorModel(weapon),box=new THREE.Box3().setFromObject(model);
  let meshes=0,mapped=0;
  model.traverse((object)=>{if(!object.isMesh)return;meshes++;const materials=Array.isArray(object.material)?object.material:[object.material];if(materials.some((material)=>material.map&&material.roughnessMap&&material.normalMap))mapped++;});
  return {weapon,meshes,mapped,forwardAxis:model.userData.forwardAxis,profile:model.userData.visualProfile,length:Number(model.userData.visualLength.toFixed(2)),extent:box.getSize(new THREE.Vector3()).toArray().map((value)=>Number(value.toFixed(2))),booster:Boolean(model.userData.booster),lod:Boolean(model.userData.assetDetailLod)};
});
console.log(JSON.stringify(result,null,2));
if(result.some((model)=>model.meshes<20||model.mapped<16||model.forwardAxis!=="+Y"||!model.booster||!model.lod)||new Set(result.map((model)=>model.profile)).size!==3||new Set(result.map((model)=>model.length)).size!==3)process.exitCode=1;
