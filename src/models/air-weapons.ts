import * as THREE from "three";
import type { AirWeaponDefinition, AirWeaponId } from "../air/types.js";
import { registerAssetDetailLod } from "../visual/asset-detail-lod.js";
import { applySurfaceDetail } from "../visual/material-textures.js";

interface WeaponVisualProfile {
  length: number;
  radius: number;
  noseLength: number;
  foreFinSpan: number;
  aftFinSpan: number;
  wingChord: number;
  bodyColor: number;
  bandColor: number;
  planform: "cruciform" | "long-chord" | "delta";
  mountedScale: number;
}

const PROFILES: Record<AirWeaponId, WeaponVisualProfile> = {
  "AGM-45A": { length: 1.8, radius: .11, noseLength: .34, foreFinSpan: .3, aftFinSpan: .4, wingChord: .28, bodyColor: 0xbfc2bb, bandColor: 0x8a3030, planform: "cruciform", mountedScale:.9 },
  "AGM-88A": { length: 2.5, radius: .16, noseLength: .48, foreFinSpan: .48, aftFinSpan: .62, wingChord: .42, bodyColor: 0xd0d1cb, bandColor: 0x8a3030, planform: "cruciform", mountedScale:.8 },
  "AIM-54A": { length: 2.65, radius: .19, noseLength: .56, foreFinSpan: .54, aftFinSpan: .72, wingChord: .48, bodyColor: 0xe6e1d3, bandColor: 0xd4a735, planform: "long-chord", mountedScale:.757 },
  "AIM-54X-CEC": { length: 2.7, radius: .19, noseLength: .56, foreFinSpan: .54, aftFinSpan: .72, wingChord: .48, bodyColor: 0xcfd8e6, bandColor: 0x4c83c3, planform: "long-chord", mountedScale:.757 },
  "AIM-7F": { length: 2.12, radius: .135, noseLength: .48, foreFinSpan: .42, aftFinSpan: .56, wingChord: .38, bodyColor: 0xe9e6da, bandColor: 0x8b5a2b, planform: "cruciform", mountedScale:.863 },
  "AIM-9L": { length: 1.55, radius: .09, noseLength: .31, foreFinSpan: .25, aftFinSpan: .42, wingChord: .26, bodyColor: 0xd7d8d1, bandColor: 0x4f4b3f, planform: "cruciform", mountedScale:.926 },
  "R-27R": { length: 2.35, radius: .16, noseLength: .5, foreFinSpan: .58, aftFinSpan: .68, wingChord: .52, bodyColor: 0xe7e7df, bandColor: 0xa74232, planform: "long-chord", mountedScale:.868 },
  "R-73": { length: 1.58, radius: .105, noseLength: .3, foreFinSpan: .28, aftFinSpan: .44, wingChord: .28, bodyColor: 0xe2e2d8, bandColor: 0x6d4935, planform: "cruciform", mountedScale:.918 },
  // KSR-5 already uses its 10.52 m class body length at the common 2 m/unit
  // air-asset scale, so it must not inherit the fighter-missile reduction.
  "KSR-5": { length: 5.05, radius: .215, noseLength: .78, foreFinSpan: .82, aftFinSpan: .48, wingChord: .96, bodyColor: 0xd7d5c9, bandColor: 0xb5312c, planform: "delta", mountedScale:1.042 },
  "AGM-84A": { length: 2.55, radius: .18, noseLength: .5, foreFinSpan: .56, aftFinSpan: .62, wingChord: .42, bodyColor: 0xdadbd3, bandColor: 0x5b6362, planform: "cruciform", mountedScale:.753 },
};

function addFinSet(group: THREE.Group, profile: WeaponVisualProfile, z: number, span: number, chord: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  shape.moveTo(profile.radius * .72, -chord * .52);
  shape.lineTo(profile.radius + span * .5, profile.planform === "delta" ? chord * .08 : -chord * .12);
  shape.lineTo(profile.radius + span * .5, chord * .34);
  shape.lineTo(profile.radius * .72, chord * .52);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .026, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -.013);
  geometry.rotateX(Math.PI * .5);
  for (let index = 0; index < 4; index++) {
    const fin = new THREE.Mesh(geometry, material);
    fin.position.z = z;
    fin.rotation.z = index * Math.PI * .5;
    fin.castShadow = true;
    group.add(fin);
  }
}

export function createAirWeaponModel(definition: Pick<AirWeaponDefinition, "id" | "guidance">) {
  const profile = PROFILES[definition.id];
  const group = new THREE.Group();
  group.name = `${definition.id}-visual`;
  group.userData.weaponVisualId = definition.id;
  group.userData.forwardAxis = "-Z";
  const bodyMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: profile.bodyColor, metalness: .34, roughness: .46 }), "missile-skin", .15);
  const finMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: profile.bodyColor, metalness: .48, roughness: .4 }), "missile-skin", .12);
  const darkMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x252a29, metalness: .52, roughness: .32 }), "dark-metal", .16);
  const halfBody = (profile.length - profile.noseLength) * .5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(profile.radius * .93, profile.radius, profile.length - profile.noseLength, 16), bodyMaterial);
  body.rotation.x = Math.PI * .5;
  body.position.z = profile.noseLength * .5;
  body.castShadow = true;
  group.add(body);
  const infrared = definition.guidance === "infrared";
  const nose = new THREE.Mesh(
    infrared ? new THREE.SphereGeometry(profile.radius * .92, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5) : new THREE.ConeGeometry(profile.radius * .94, profile.noseLength, 16),
    infrared ? new THREE.MeshPhysicalMaterial({ color: 0x191d1b, roughness: .08, metalness: .12, clearcoat: 1, clearcoatRoughness: .04 }) : bodyMaterial,
  );
  nose.rotation.x = infrared ? Math.PI * .5 : -Math.PI * .5;
  nose.position.z = -halfBody;
  group.add(nose);
  const wingZ = profile.planform === "delta" ? .28 : .12;
  addFinSet(group, profile, wingZ, profile.foreFinSpan, profile.planform === "long-chord" ? profile.wingChord * .72 : profile.wingChord, finMaterial);
  addFinSet(group, profile, halfBody - profile.wingChord * .55, profile.aftFinSpan, profile.wingChord, finMaterial);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(profile.radius * .62, profile.radius * .76, .18, 12), darkMaterial);
  nozzle.rotation.x = Math.PI * .5;
  nozzle.position.z = halfBody + .09;
  group.add(nozzle);
  if (definition.id === "AGM-84A") {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(.22, .18, .42), darkMaterial);
    intake.position.set(0, -profile.radius * 1.02, .24);
    group.add(intake);
  }
  const high = new THREE.Group();
  high.name = "weapon-high-surface-detail";
  for (const fraction of [-.22, .18, .42]) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(profile.radius * .985, .008, 4, 20), darkMaterial);
    seam.scale.y = .96;
    seam.position.z = fraction * profile.length;
    high.add(seam);
  }
  const bandMaterial = new THREE.MeshStandardMaterial({ color: profile.bandColor, metalness: .24, roughness: .5 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(profile.radius * 1.008, profile.radius * 1.008, .09, 16), bandMaterial);
  band.rotation.x = Math.PI * .5;
  band.position.z = -.16;
  high.add(band);
  group.add(high);
  registerAssetDetailLod(group, { nearDistance: 46, mediumDistance: 110, high: [high] });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(profile.radius * .72, Math.max(.7, profile.length * .42), 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa34f, transparent: true, opacity: .76, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI * .5;
  flame.position.z = halfBody + Math.max(.4, profile.length * .21);
  group.add(flame);
  group.userData.flame = flame;
  group.userData.visualLength = profile.length;
  group.userData.visualProfile = profile.planform;
  group.userData.mountedScale = profile.mountedScale;
  // Unscaled distance from the model origin to the upper body surface. The
  // shared aircraft mounting path uses this instead of the full bounding box,
  // whose vertical fins are not the physical suspension contact.
  group.userData.mountContactY = profile.radius;
  return group;
}

export function airWeaponVisualProfiles() {
  return PROFILES;
}
