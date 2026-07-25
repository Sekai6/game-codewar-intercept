import * as THREE from "three";
globalThis.window={devicePixelRatio:1};
const { THREAT_DEFINITIONS }=await import("../dist-test/threats/catalog.js");

const result=THREAT_DEFINITIONS.map((definition)=>{
  const model=definition.createModel();let meshes=0,mapped=0;
  model.traverse((object)=>{if(!object.isMesh)return;meshes++;const materials=Array.isArray(object.material)?object.material:[object.material];if(materials.some((material)=>material.map&&material.roughnessMap&&material.normalMap))mapped++;});
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  return {id:definition.id,visualId:model.userData.weaponVisualId,forwardAxis:model.userData.forwardAxis,meshes,mapped,surfaceDetails:model.userData.surfaceDetailCount??0,particleCount:model.userData.particleCount??0,seekerFov:Boolean(model.userData.seekerFov),lod:Boolean(model.userData.assetDetailLod),bodyExtent:Number(size.z.toFixed(2))};
});
console.log(JSON.stringify(result,null,2));
if(result.length!==5||result.some((model)=>model.visualId!==model.id||model.forwardAxis!=="-Z"||model.meshes<15||model.mapped<7||model.surfaceDetails<5||model.particleCount<2||!model.seekerFov||!model.lod)||new Set(result.map((model)=>model.bodyExtent)).size<4)process.exitCode=1;
