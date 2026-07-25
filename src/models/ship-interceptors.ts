import * as THREE from "three";
import type { WeaponType } from "../combat-types.js";
import { registerAssetDetailLod } from "../visual/asset-detail-lod.js";
import { applySurfaceDetail } from "../visual/material-textures.js";

interface InterceptorProfile {
  bodyLength: number;
  bodyRadius: number;
  noseLength: number;
  boosterLength: number;
  boosterRadius: number;
  forwardFin: number;
  aftFin: number;
  bandColor: number;
  scale: THREE.Vector3;
}

const PROFILES: Record<WeaponType, InterceptorProfile> = {
  "RIM-67": { bodyLength:6.4, bodyRadius:.55, noseLength:2.1, boosterLength:2.8, boosterRadius:.7, forwardFin:1.05, aftFin:1.35, bandColor:0xc6a24a, scale:new THREE.Vector3(.58,.58,.58) },
  "SM-2MR": { bodyLength:5.6, bodyRadius:.42, noseLength:1.7, boosterLength:2.2, boosterRadius:.55, forwardFin:.72, aftFin:.92, bandColor:0x82512f, scale:new THREE.Vector3(.58,.58,.58) },
  "SM-2ER": { bodyLength:5.8, bodyRadius:.42, noseLength:1.75, boosterLength:2.85, boosterRadius:.62, forwardFin:.74, aftFin:1.02, bandColor:0xd39a43, scale:new THREE.Vector3(.63,.72,.63) },
};

function finGeometry(radius: number, span: number, chord: number, swept: boolean) {
  const shape = new THREE.Shape();
  shape.moveTo(radius * .72, -chord * .5);
  shape.lineTo(radius + span, swept ? -chord * .02 : -chord * .2);
  shape.lineTo(radius + span, chord * .32);
  shape.lineTo(radius * .72, chord * .5);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth:.035, bevelEnabled:false, curveSegments:1 });
  geometry.translate(0, 0, -.0175);
  return geometry;
}

function addFinSet(parent: THREE.Group, y: number, radius: number, span: number, chord: number, material: THREE.Material, swept: boolean) {
  const geometry = finGeometry(radius, span, chord, swept);
  for (let index=0; index<4; index++) {
    const fin = new THREE.Mesh(geometry, material);
    fin.position.y = y;
    fin.rotation.y = index * Math.PI * .5;
    fin.castShadow = true;
    parent.add(fin);
  }
}

export function createShipInterceptorModel(weapon: WeaponType) {
  const profile = PROFILES[weapon], root = new THREE.Group();
  root.name = `${weapon} interceptor visual`;
  root.userData.weaponVisualId = weapon;
  root.userData.forwardAxis = "+Y";
  const skin = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: weapon === "RIM-67" ? 0xd9d7c7 : 0xf0eee4, metalness:.34, roughness:.43 }), "missile-skin", .18);
  const dark = applySurfaceDetail(new THREE.MeshStandardMaterial({ color:0x303735, metalness:.5, roughness:.38 }), "dark-metal", .16);
  const boosterSkin = applySurfaceDetail(new THREE.MeshStandardMaterial({ color:0xb9bcb4, metalness:.38, roughness:.47 }), "missile-skin", .16);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(profile.bodyRadius*.9, profile.bodyRadius, profile.bodyLength, 18), skin);
  body.castShadow = true;
  root.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(profile.bodyRadius*.91, profile.noseLength, 18), skin);
  nose.position.y = profile.bodyLength*.5 + profile.noseLength*.5;
  nose.castShadow = true;
  root.add(nose);
  addFinSet(root, profile.bodyLength*.22, profile.bodyRadius, profile.forwardFin, 1.28, skin, true);
  addFinSet(root, -profile.bodyLength*.34, profile.bodyRadius, profile.aftFin, 1.42, skin, false);
  const booster = new THREE.Group();
  booster.name = `${weapon} detachable booster`;
  booster.position.y = -profile.bodyLength*.5 - profile.boosterLength*.5;
  const boosterBody = new THREE.Mesh(new THREE.CylinderGeometry(profile.boosterRadius*.86, profile.boosterRadius, profile.boosterLength, 16), boosterSkin);
  boosterBody.castShadow = true;
  booster.add(boosterBody);
  addFinSet(booster, -profile.boosterLength*.24, profile.boosterRadius, profile.aftFin*1.08, 1.18, boosterSkin, true);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(profile.boosterRadius*.55, profile.boosterRadius*.72, .32, 14), dark);
  nozzle.position.y = -profile.boosterLength*.5 - .16;
  booster.add(nozzle);
  root.add(booster);
  root.userData.booster = booster;
  const high = new THREE.Group();
  high.name = "interceptor-high-surface-detail";
  for (const fraction of [-.28,.04,.34]) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(profile.bodyRadius*.985,.018,5,24),dark);
    seam.rotation.x = Math.PI*.5;
    seam.position.y = fraction*profile.bodyLength;
    high.add(seam);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(profile.bodyRadius*1.008,profile.bodyRadius*1.008,.24,18),new THREE.MeshStandardMaterial({color:profile.bandColor,metalness:.22,roughness:.48}));
  band.position.y = profile.bodyLength*.12;
  high.add(band);
  root.add(high);
  root.scale.copy(profile.scale);
  registerAssetDetailLod(root,{nearDistance:70,mediumDistance:180,high:[high]});
  root.userData.visualLength = (profile.bodyLength+profile.noseLength+profile.boosterLength)*profile.scale.y;
  root.userData.visualProfile = weapon === "SM-2ER" ? "extended-range" : weapon === "SM-2MR" ? "medium-range" : "rim-67";
  return root;
}

export function shipInterceptorVisualProfiles() { return PROFILES; }
