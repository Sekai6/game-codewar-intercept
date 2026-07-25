import * as THREE from "three";
import { createAirWeaponModel } from "../dist-test/models/air-weapons.js";

const weapons = [
  ["AIM-54A", "active-radar"],
  ["AIM-7F", "semi-active-radar"],
  ["AIM-9L", "infrared"],
  ["R-27R", "semi-active-radar"],
  ["R-73", "infrared"],
  ["KSR-5", "anti-ship-radar"],
  ["AGM-84A", "anti-ship-radar"],
];

const result = weapons.map(([id, guidance]) => {
  const model = createAirWeaponModel({ id, guidance });
  const box = new THREE.Box3().setFromObject(model);
  let meshes = 0, mapped = 0;
  model.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material.map && material.roughnessMap && material.normalMap)) mapped++;
  });
  return {
    id,
    meshes,
    mapped,
    length: Number(model.userData.visualLength),
    planform: model.userData.visualProfile,
    extent: box.getSize(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(2))),
    flame: Boolean(model.userData.flame),
    lod: Boolean(model.userData.assetDetailLod),
  };
});

console.log(JSON.stringify(result, null, 2));
const distinctLengths = new Set(result.map((weapon) => weapon.length)).size;
const distinctPlanforms = new Set(result.map((weapon) => weapon.planform)).size;
if (result.some((weapon) => weapon.meshes < 12 || weapon.mapped < 2 || !weapon.flame || !weapon.lod) || distinctLengths < 6 || distinctPlanforms !== 3)
  process.exitCode = 1;
