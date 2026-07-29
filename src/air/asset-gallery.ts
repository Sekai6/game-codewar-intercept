import * as THREE from "three";
import { AIR_PLATFORM_BY_ID, AIR_WEAPONS } from "./catalog.js";
import { createA6Model, createF14Model, createMig29Model, createTu16Model } from "./models.js";
import { createE2cModel, createTu126Model } from "./aew/models.js";
import type { AirWeaponId } from "./types.js";
import { attachAirWeaponModel } from "./weapon-mounting.js";
import { createAirWeaponModel } from "../models/air-weapons.js";
import {
  updateRegisteredAssetDetailLods,
  type AssetDetailLodRegistration,
  type AssetDetailQuality,
} from "../visual/asset-detail-lod.js";
import {
  applyDeclaredWingSweep,
  declaredWingSweepRange,
} from "./variable-geometry.js";

type GalleryAircraftId = "F-14A" | "A-6E" | "MIG-29A" | "TU-16K" | "E-2C" | "TU-126";
type GalleryView = "front" | "right" | "top" | "bottom" | "rear-quarter";

const factories: Record<GalleryAircraftId, () => THREE.Group> = {
  "F-14A": createF14Model,
  "A-6E": createA6Model,
  "MIG-29A": createMig29Model,
  "TU-16K": createTu16Model,
  "E-2C": createE2cModel,
  "TU-126": createTu126Model,
};

const params = new URLSearchParams(location.search);
const requestedType = params.get("type") as GalleryAircraftId | null;
const type = requestedType && factories[requestedType] ? requestedType : "F-14A";
const quality = (params.get("quality") ?? "ultra") as AssetDetailQuality;
const view = (params.get("view") ?? "rear-quarter") as GalleryView;
const requestedSweepParam = params.get("sweep");
const requestedSweepDeg = requestedSweepParam === null
  ? null
  : Number(requestedSweepParam);
const showStores = params.get("stores") === "1";

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eaaae);
scene.fog = new THREE.Fog(0x9eaaae, 95, 150);
scene.add(new THREE.HemisphereLight(0xd9e6eb, 0x34444b, 2.25));
const key = new THREE.DirectionalLight(0xffe5bf, 4.8);
key.position.set(-18, 24, -28);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9bc7e8, 2.1);
fill.position.set(24, 11, 18);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xddefff, 1.4);
rim.position.set(-20, 8, 28);
scene.add(rim);
// Dedicated inspection fill for the lower hemisphere. Production lighting is
// intentionally more directional, but a validation gallery must still expose
// underside normals, pylon contact, and store clearance instead of rendering
// the complete belly as a black silhouette.
const undersideFill = new THREE.DirectionalLight(
  0xc8deea,
  view === "bottom" ? 3.2 : 0.85,
);
undersideFill.position.set(9, -22, -12);
scene.add(undersideFill);

const model = factories[type]();
const sweepRange = declaredWingSweepRange(model);
let sweepDeg = 0;
if (sweepRange) {
  const requestedSweep = requestedSweepDeg !== null && Number.isFinite(requestedSweepDeg)
    ? THREE.MathUtils.degToRad(requestedSweepDeg)
    : sweepRange[0];
  const appliedSweep = applyDeclaredWingSweep(
    model,
    (requestedSweep - sweepRange[0]) /
      Math.max(1e-6, sweepRange[1] - sweepRange[0]),
  );
  sweepDeg = THREE.MathUtils.radToDeg(appliedSweep ?? sweepRange[0]);
}

const mountedWeapons: AirWeaponId[] = [];
if (showStores) {
  const definition = AIR_PLATFORM_BY_ID[type];
  const remaining = new Map(
    Object.entries(definition.loadout) as [AirWeaponId, number][],
  );
  for (const hardpoint of definition.hardpoints) {
    const weaponId = hardpoint.compatibleWeapons.find(
      (candidate) => (remaining.get(candidate) ?? 0) > 0,
    );
    if (!weaponId) continue;
    remaining.set(weaponId, (remaining.get(weaponId) ?? 0) - 1);
    const weapon = createAirWeaponModel(AIR_WEAPONS[weaponId]);
    attachAirWeaponModel(model, hardpoint, weapon);
    mountedWeapons.push(weaponId);
  }
}
scene.add(model);
model.updateMatrixWorld(true);

const detailLod = model.userData.assetDetailLod as AssetDetailLodRegistration | undefined;
detailLod?.high.forEach((object) => { object.visible = quality === "ultra"; });
detailLod?.medium?.forEach((object) => { object.visible = quality === "high"; });
detailLod?.low?.forEach((object) => { object.visible = quality === "low"; });

// Runtime exhaust, contrail and damage effects are not part of the aircraft
// dimensions. Keeping them out of the gallery prevents a long tail plume from
// shrinking the actual airframe inside the orthographic inspection frame.
const transientVisuals: THREE.Object3D[] = [
  ...((model.userData.exhausts as THREE.Object3D[] | undefined) ?? []),
  ...((model.userData.contrails as THREE.Object3D[] | undefined) ?? []),
  ...[
    model.userData.damageSmoke,
    model.userData.damageFire,
    model.userData.crashSplash,
  ].filter((object): object is THREE.Object3D => object instanceof THREE.Object3D),
];
transientVisuals.forEach((object) => { object.visible = false; });

const transientSet = new Set<THREE.Object3D>(transientVisuals);
const isEffectivelyVisible = (object: THREE.Object3D) => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
};
const belongsToTransientVisual = (object: THREE.Object3D) => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (transientSet.has(current)) return true;
  }
  return false;
};
const visibleBoundingBox = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const result = new THREE.Box3();
  const meshBox = new THREE.Box3();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !isEffectivelyVisible(object) || belongsToTransientVisual(object)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    meshBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    result.union(meshBox);
  });
  return result;
};

let box = visibleBoundingBox(model);
const center = box.getCenter(new THREE.Vector3());
model.position.sub(center);
model.updateMatrixWorld(true);
box = visibleBoundingBox(model);
const size = box.getSize(new THREE.Vector3());
const maximumDimension = Math.max(size.x, size.y, size.z);

const aspect = innerWidth / innerHeight;
let projectedWidth = size.x;
let projectedHeight = size.y;
if (view === "right") projectedWidth = size.z;
if (view === "top" || view === "bottom") {
  projectedWidth = size.x;
  projectedHeight = size.z;
}
if (view === "rear-quarter") {
  projectedWidth = Math.hypot(size.x, size.z) * 0.78;
  projectedHeight = size.y + maximumDimension * 0.14;
}
const viewHeight = Math.max(projectedHeight * 1.34, projectedWidth / aspect * 1.24, 2.5);
const camera = new THREE.OrthographicCamera(
  -viewHeight * aspect * 0.5,
  viewHeight * aspect * 0.5,
  viewHeight * 0.5,
  -viewHeight * 0.5,
  0.1,
  220,
);
const directions: Record<GalleryView, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0.04, -1),
  right: new THREE.Vector3(1, 0.02, 0),
  top: new THREE.Vector3(0, 1, 0.001),
  bottom: new THREE.Vector3(0, -1, -0.001),
  "rear-quarter": new THREE.Vector3(0.78, 0.34, 1),
};
camera.position.copy(directions[view].normalize().multiplyScalar(50));
camera.up.set(0, 1, 0);
if (view === "top" || view === "bottom") camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();
scene.add(camera);

updateRegisteredAssetDetailLods(scene, camera.position, quality);
model.updateMatrixWorld(true);

const groundY = box.min.y - maximumDimension * 0.06;
const grid = new THREE.GridHelper(maximumDimension * 1.8, 20, 0x4f686e, 0x73878b);
grid.position.y = groundY;
grid.material.transparent = true;
grid.material.opacity = view === "top" ? 0.18 : view === "bottom" ? 0.1 : 0.34;
scene.add(grid);

let meshes = 0;
let triangles = 0;
model.traverse((object) => {
  if (!(object instanceof THREE.Mesh) || !isEffectivelyVisible(object)) return;
  meshes++;
  const geometry = object.geometry;
  triangles += geometry.index
    ? geometry.index.count / 3
    : (geometry.getAttribute("position")?.count ?? 0) / 3;
});

const dimensions = {
  x: Number(size.x.toFixed(2)),
  y: Number(size.y.toFixed(2)),
  z: Number(size.z.toFixed(2)),
};
const info = document.querySelector("#info") as HTMLElement;
info.textContent = [
  `${type} / ${quality.toUpperCase()} / ${view.toUpperCase()}`,
  `MODEL EXTENT  X ${dimensions.x}  Y ${dimensions.y}  Z ${dimensions.z}`,
  `REAL LENGTH  ${Number(model.userData.realLengthMeters ?? 0).toFixed(2)} M`,
  `REAL SPAN    ${Number(model.userData.realWingspanMeters ?? 0).toFixed(2)} M`,
  `VISIBLE MESH ${meshes}  TRI ${Math.round(triangles)}`,
  showStores ? `STORES       ${mountedWeapons.join(" / ") || "NONE"}` : "",
  type === "F-14A" ? `WING SWEEP   ${sweepDeg.toFixed(0)} DEG` : "",
].filter(Boolean).join("\n");
const scale = document.querySelector("#scale") as HTMLElement;
scale.textContent = `${Math.max(2, Math.round(maximumDimension * 0.25)) * 2} M VISUAL REFERENCE`;

renderer.render(scene, camera);
renderer.domElement.dataset.galleryReady = "true";
renderer.domElement.dataset.aircraftType = type;
renderer.domElement.dataset.assetQuality = quality;
renderer.domElement.dataset.galleryView = view;
renderer.domElement.dataset.visibleMeshes = String(meshes);
renderer.domElement.dataset.visibleTriangles = String(Math.round(triangles));
renderer.domElement.dataset.modelExtent = `${dimensions.x},${dimensions.y},${dimensions.z}`;
renderer.domElement.dataset.mountedWeapons = mountedWeapons.join(",");

Object.assign(window, {
  __aircraftGallery: {
    type,
    quality,
    view,
    sweepDeg,
    stores: showStores,
    mountedWeapons,
    meshes,
    triangles: Math.round(triangles),
    dimensions,
  },
});
