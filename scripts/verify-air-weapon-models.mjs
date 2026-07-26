import * as THREE from "three";
import { airWeaponVisualProfiles, createAirWeaponModel } from "../dist-test/models/air-weapons.js";

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
    mountedScale: Number(model.userData.mountedScale),
    mountedLength: Number((model.userData.visualLength * model.userData.mountedScale).toFixed(3)),
    planform: model.userData.visualProfile,
    extent: box.getSize(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(2))),
    flame: Boolean(model.userData.flame),
    lod: Boolean(model.userData.assetDetailLod),
  };
});

console.log(JSON.stringify(result, null, 2));
const distinctLengths = new Set(result.map((weapon) => weapon.length)).size;
const distinctPlanforms = new Set(result.map((weapon) => weapon.planform)).size;
const ksr5 = airWeaponVisualProfiles()["KSR-5"];
const ksr5FinenessRatio = ksr5.length / (ksr5.radius * 2);
const ksr5SpanRatio = (ksr5.radius * 2 + Math.max(ksr5.foreFinSpan, ksr5.aftFinSpan)) / ksr5.length;
const ksr5Rendered = result.find((weapon) => weapon.id === "KSR-5");
if (
  result.some((weapon) => weapon.meshes < 12 || weapon.mapped < 2 || !weapon.flame || !weapon.lod) ||
  result.some((weapon) => !Number.isFinite(weapon.mountedScale) || weapon.mountedScale <= 0) ||
  distinctLengths < 6 ||
  distinctPlanforms !== 3 ||
  !ksr5Rendered ||
  ksr5.planform !== "delta" ||
  ksr5.foreFinSpan <= ksr5.aftFinSpan ||
  ksr5FinenessRatio < 11 ||
  ksr5FinenessRatio > 12.5 ||
  ksr5SpanRatio < .23 ||
  ksr5SpanRatio > .27 ||
  ksr5Rendered.length < 5 ||
  Math.abs(ksr5Rendered.mountedLength - 5.26) > .03
)
  process.exitCode = 1;
