import * as THREE from "three";
import { buildLongBeach } from "../models/long-beach.js";
import { buildTiconderoga } from "../models/ticonderoga.js";
import { MOSKVA } from "../platforms/models/moskva.js";

type GalleryPlatformId = "cgn-9" | "cg-57" | "project-1164";
type GalleryQuality = "ultra" | "high" | "standard";
type GalleryView = "bow-quarter" | "starboard" | "top" | "stern-quarter";

interface PlatformGalleryDefinition {
  name: string;
  realLengthMeters: number;
  realBeamMeters: number;
  build: () => THREE.Group;
}

const platforms: Record<GalleryPlatformId, PlatformGalleryDefinition> = {
  "cgn-9": {
    name: "USS LONG BEACH (CGN-9)",
    realLengthMeters: 219.8,
    realBeamMeters: 22.3,
    build: () => buildLongBeach(),
  },
  "cg-57": {
    name: "USS LAKE CHAMPLAIN (CG-57)",
    realLengthMeters: 172.8,
    realBeamMeters: 16.8,
    build: buildTiconderoga,
  },
  "project-1164": {
    name: "PROJECT 1164 / SLAVA CLASS",
    realLengthMeters: 186.4,
    realBeamMeters: 20.8,
    build: MOSKVA.buildModel,
  },
};

const params = new URLSearchParams(location.search);
const requestedPlatform = params.get("platform") as GalleryPlatformId | null;
const platformId = requestedPlatform && platforms[requestedPlatform]
  ? requestedPlatform
  : "cgn-9";
const requestedQuality = params.get("quality") as GalleryQuality | null;
const quality: GalleryQuality = requestedQuality === "high" || requestedQuality === "standard"
  ? requestedQuality
  : "ultra";
const requestedView = params.get("view") as GalleryView | null;
const view: GalleryView = requestedView && ["bow-quarter", "starboard", "top", "stern-quarter"].includes(requestedView)
  ? requestedView
  : "bow-quarter";

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x849399);
scene.fog = new THREE.Fog(0x849399, 210, 330);
scene.add(new THREE.HemisphereLight(0xdce9ed, 0x283940, 2.3));
const key = new THREE.DirectionalLight(0xffdfb0, 4.7);
key.position.set(65, 90, -80);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9bc9ea, 2.15);
fill.position.set(-70, 38, 65);
scene.add(fill);
const undersideFill = new THREE.DirectionalLight(0xb7d3df, view === "top" ? 0.25 : 0.7);
undersideFill.position.set(10, -50, -30);
scene.add(undersideFill);

const definition = platforms[platformId];
const model = definition.build();
model.updateMatrixWorld(true);
scene.add(model);

const highDetail = model.userData.highDetail as THREE.Object3D | undefined;
const mediumDetail = model.userData.mediumDetail as THREE.Object3D | undefined;
const lowDetail = model.userData.lowDetail as THREE.Object3D | undefined;
const persistentDetail = (model.userData.detail as THREE.Object3D[] | undefined) ?? [];
if (highDetail) highDetail.visible = quality === "ultra";
if (mediumDetail) mediumDetail.visible = quality === "high";
if (lowDetail) lowDetail.visible = quality === "standard";
persistentDetail.forEach((object) => { object.visible = quality !== "standard"; });

const transientVisuals = new Set<THREE.Object3D>();
const registerTransient = (value: unknown) => {
  if (value instanceof THREE.Object3D) transientVisuals.add(value);
  if (Array.isArray(value)) value.forEach(registerTransient);
};
registerTransient(model.userData.smokePuffs);
registerTransient(model.userData.ewPulse);
registerTransient(model.userData.navigationLights);
registerTransient(model.userData.lightBulbs);
model.traverse((object) => {
  if (object.userData.temporalReactive || object instanceof THREE.Light) transientVisuals.add(object);
});
transientVisuals.forEach((object) => { object.visible = false; });

const isEffectivelyVisible = (object: THREE.Object3D) => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
};
const belongsToTransientVisual = (object: THREE.Object3D) => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (transientVisuals.has(current)) return true;
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
if (view === "starboard") projectedWidth = size.x;
if (view === "top") {
  projectedWidth = size.x;
  projectedHeight = size.z;
}
if (view === "bow-quarter" || view === "stern-quarter") {
  projectedWidth = Math.hypot(size.x, size.z) * 0.9;
  projectedHeight = size.y + maximumDimension * 0.08;
}
const viewHeight = Math.max(projectedHeight * 1.42, projectedWidth / aspect * 1.22, 10);
const camera = new THREE.OrthographicCamera(
  -viewHeight * aspect * 0.5,
  viewHeight * aspect * 0.5,
  viewHeight * 0.5,
  -viewHeight * 0.5,
  0.1,
  500,
);
const directions: Record<GalleryView, THREE.Vector3> = {
  "bow-quarter": new THREE.Vector3(1, 0.42, -0.9),
  starboard: new THREE.Vector3(0, 0.12, -1),
  top: new THREE.Vector3(0, 1, -0.001),
  "stern-quarter": new THREE.Vector3(-1, 0.35, -0.9),
};
camera.position.copy(directions[view].normalize().multiplyScalar(180));
camera.up.set(0, 1, 0);
// Keep the ship's +X bow axis horizontal in the inspection image.  Mapping
// +X to screen vertical made the orthographic fit use beam as its height and
// cropped both ends of long hulls.
if (view === "top") camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();
scene.add(camera);

const groundY = box.min.y - maximumDimension * 0.035;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(maximumDimension * 2.4, maximumDimension * 2.4),
  new THREE.MeshStandardMaterial({ color: 0x304d55, roughness: 0.82, metalness: 0.05 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = groundY;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(maximumDimension * 2.2, 24, 0x456b73, 0x6f8589);
grid.position.y = groundY + 0.02;
grid.material.transparent = true;
grid.material.opacity = view === "top" ? 0.2 : 0.32;
scene.add(grid);

let meshes = 0;
let triangles = 0;
model.traverse((object) => {
  if (!(object instanceof THREE.Mesh) || !isEffectivelyVisible(object) || belongsToTransientVisual(object)) return;
  meshes++;
  const geometry = object.geometry;
  const geometryTriangles = geometry.index
    ? geometry.index.count / 3
    : (geometry.getAttribute("position")?.count ?? 0) / 3;
  triangles += geometryTriangles * (object instanceof THREE.InstancedMesh ? object.count : 1);
  object.castShadow = true;
  object.receiveShadow = true;
});

const dimensions = {
  length: Number(size.x.toFixed(2)),
  height: Number(size.y.toFixed(2)),
  beam: Number(size.z.toFixed(2)),
};
const declaredHullLength = Number(model.userData.hullLength ?? 0);
const declaredHullBeam = Number(model.userData.hullBeam ?? 0);
const modelRatio = declaredHullLength > 0 && declaredHullBeam > 0
  ? declaredHullLength / declaredHullBeam
  : 0;
const realRatio = definition.realLengthMeters / definition.realBeamMeters;
const info = document.querySelector("#info") as HTMLElement;
info.textContent = [
  `${definition.name} / ${quality.toUpperCase()} / ${view.toUpperCase()}`,
  `VISIBLE EXTENT L ${dimensions.length}  H ${dimensions.height}  B ${dimensions.beam}`,
  `HULL L/B      ${modelRatio > 0 ? modelRatio.toFixed(2) : "NOT DECLARED"}`,
  `REAL L/B      ${realRatio.toFixed(2)}  (${definition.realLengthMeters.toFixed(1)} M / ${definition.realBeamMeters.toFixed(1)} M)`,
  `VISIBLE MESH  ${meshes}  TRI ${Math.round(triangles)}`,
].join("\n");
const scale = document.querySelector("#scale") as HTMLElement;
scale.textContent = `${Math.max(10, Math.round(definition.realLengthMeters * 0.1 / 5) * 5)} M VISUAL REFERENCE`;

renderer.render(scene, camera);
renderer.domElement.dataset.galleryReady = "true";
renderer.domElement.dataset.surfacePlatform = platformId;
renderer.domElement.dataset.assetQuality = quality;
renderer.domElement.dataset.galleryView = view;
renderer.domElement.dataset.visibleMeshes = String(meshes);
renderer.domElement.dataset.visibleTriangles = String(Math.round(triangles));
renderer.domElement.dataset.modelExtent = `${dimensions.length},${dimensions.height},${dimensions.beam}`;
renderer.domElement.dataset.modelLengthBeamRatio = modelRatio.toFixed(3);

Object.assign(window, {
  __surfaceGallery: {
    platformId,
    name: definition.name,
    quality,
    view,
    meshes,
    triangles: Math.round(triangles),
    dimensions,
    hullLength: declaredHullLength,
    hullBeam: declaredHullBeam,
    modelLengthBeamRatio: modelRatio > 0 ? Number(modelRatio.toFixed(3)) : null,
    realLengthBeamRatio: Number(realRatio.toFixed(3)),
  },
});
