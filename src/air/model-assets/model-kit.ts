import * as THREE from "three";
import { applySurfaceDetail } from "../../visual/material-textures.js";
import { registerAssetDetailLod } from "../../visual/asset-detail-lod.js";

// Air assets are intentionally enlarged for tactical readability, but every
// aircraft uses the same 2 m/unit display scale so their relative sizes stay
// physically meaningful (especially Tu-16K and Tu-126 versus fighters).
export const AIR_MODEL_METERS_PER_UNIT = 2;
export const AIRCRAFT_MODEL_ASSET_REVISION = "aircraft-ultra-r2";
export const metersToModel = (meters: number) => meters / AIR_MODEL_METERS_PER_UNIT;

export type Vec3Tuple = readonly [number, number, number];
export type PlanformPoint = readonly [number, number];
export type AirWeaponMountMap = Record<string, THREE.Object3D>;

export interface FuselageStation {
  z: number;
  radiusX: number;
  radiusY: number;
  centerY?: number;
}

export interface AircraftModelTiers {
  ultra: THREE.Group;
  high: THREE.Group;
  low: THREE.Group;
}

interface AircraftTierMembers {
  ultra: THREE.Object3D[];
  high: THREE.Object3D[];
  low: THREE.Object3D[];
}

export interface AirWeaponMountPiece {
  offset: Vec3Tuple;
  size: Vec3Tuple;
}

export interface AirWeaponMountHardware {
  ultraParent: THREE.Object3D;
  highParent?: THREE.Object3D;
  ultraPieces: readonly AirWeaponMountPiece[];
  highPieces?: readonly AirWeaponMountPiece[];
}

export interface FinishAircraftOptions {
  length: number;
  realLengthMeters: number;
  realWingspanMeters: number;
  engines: readonly THREE.Vector3[];
  detailTags: readonly string[];
  lodNear?: number;
  lodMedium?: number;
}

export const aircraftPaint = (color: number, roughness = 0.47, textureScale = 0.18) =>
  applySurfaceDetail(
    new THREE.MeshStandardMaterial({ color, metalness: 0.34, roughness }),
    "painted-metal",
    textureScale,
  );

export const aircraftDarkMaterial = applySurfaceDetail(
  new THREE.MeshStandardMaterial({ color: 0x20282a, metalness: 0.58, roughness: 0.34 }),
  "dark-metal",
  0.2,
);

export const aircraftPanelMaterial = applySurfaceDetail(
  new THREE.MeshStandardMaterial({ color: 0x515b5a, metalness: 0.48, roughness: 0.46 }),
  "dark-metal",
  0.17,
);

export const aircraftSeamMaterial = new THREE.MeshStandardMaterial({
  color: 0x313b3b,
  metalness: 0.35,
  roughness: 0.62,
});

export const aircraftGlassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x183d50,
  metalness: 0.08,
  roughness: 0.12,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  transparent: true,
  opacity: 0.86,
  envMapIntensity: 1.35,
});

export function createAircraftTiers(root: THREE.Group): AircraftModelTiers {
  const tiers: AircraftModelTiers = {
    ultra: new THREE.Group(),
    high: new THREE.Group(),
    low: new THREE.Group(),
  };
  tiers.ultra.name = "aircraft-tier:ultra";
  tiers.high.name = "aircraft-tier:high";
  tiers.low.name = "aircraft-tier:low";
  root.add(tiers.ultra, tiers.high, tiers.low);
  root.userData.modelTiers = tiers;
  root.userData.modelTierMembers = {
    ultra: [tiers.ultra],
    high: [tiers.high],
    low: [tiers.low],
  } satisfies AircraftTierMembers;
  return tiers;
}

export function createAircraftTierBranch(
  root: THREE.Group,
  parent: THREE.Object3D,
  name: string,
) {
  const tiers: AircraftModelTiers = {
    ultra: new THREE.Group(),
    high: new THREE.Group(),
    low: new THREE.Group(),
  };
  tiers.ultra.name = `${name}:ultra`;
  tiers.high.name = `${name}:high`;
  tiers.low.name = `${name}:low`;
  parent.add(tiers.ultra, tiers.high, tiers.low);
  const members = root.userData.modelTierMembers as AircraftTierMembers;
  members.ultra.push(tiers.ultra);
  members.high.push(tiers.high);
  members.low.push(tiers.low);
  return tiers;
}

export function createLoftedFuselageGeometry(
  stations: readonly FuselageStation[],
  radialSegments = 24,
) {
  if (stations.length < 2) throw new Error("A lofted fuselage requires at least two stations");
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  stations.forEach((station, stationIndex) => {
    for (let segment = 0; segment < radialSegments; segment++) {
      const theta = segment / radialSegments * Math.PI * 2;
      positions.push(
        Math.cos(theta) * Math.max(0.004, station.radiusX),
        (station.centerY ?? 0) + Math.sin(theta) * Math.max(0.004, station.radiusY),
        station.z,
      );
      uvs.push(segment / radialSegments, stationIndex / (stations.length - 1));
    }
  });
  for (let stationIndex = 0; stationIndex < stations.length - 1; stationIndex++) {
    const current = stationIndex * radialSegments;
    const next = (stationIndex + 1) * radialSegments;
    for (let segment = 0; segment < radialSegments; segment++) {
      const following = (segment + 1) % radialSegments;
      indices.push(
        current + segment,
        next + following,
        next + segment,
        current + segment,
        current + following,
        next + following,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLoftedFuselage(
  stations: readonly FuselageStation[],
  material: THREE.Material,
  radialSegments = 24,
) {
  return new THREE.Mesh(createLoftedFuselageGeometry(stations, radialSegments), material);
}

export function createPlanformGeometry(points: readonly PlanformPoint[], thickness = 0.08) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -thickness * 0.5);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPlanform(
  points: readonly PlanformPoint[],
  material: THREE.Material,
  thickness = 0.08,
) {
  return new THREE.Mesh(createPlanformGeometry(points, thickness), material);
}

export function createHalfWing(
  side: number,
  span: number,
  rootChord: number,
  tipChord: number,
  leadingEdgeSweep: number,
  material: THREE.Material,
  thickness = 0.08,
) {
  const rootLeading = -rootChord * 0.5;
  const tipLeading = rootLeading + leadingEdgeSweep;
  return createPlanform([
    [0, rootLeading],
    [side * span, tipLeading],
    [side * span, tipLeading + tipChord],
    [0, rootLeading + rootChord],
  ], material, thickness);
}

export function createVerticalSurface(
  points: readonly PlanformPoint[],
  thickness: number,
  material: THREE.Material,
) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => index ? shape.lineTo(z, y) : shape.moveTo(z, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness * 0.5);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function createAxialCapsule(
  radius: number,
  cylinderLength: number,
  material: THREE.Material,
  radialSegments = 16,
) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, cylinderLength, 6, radialSegments), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

export function createAxialCone(
  radius: number,
  length: number,
  material: THREE.Material,
  radialSegments = 16,
) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, radialSegments), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function createCanopy(
  position: Vec3Tuple,
  scale: Vec3Tuple,
  material: THREE.Material = aircraftGlassMaterial,
  radialSegments = 20,
) {
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, radialSegments, Math.max(8, radialSegments / 2)), material);
  canopy.position.set(...position);
  canopy.scale.set(...scale);
  return canopy;
}

export function createIntake(
  width: number,
  height: number,
  depth: number,
  frameMaterial: THREE.Material,
  throatMaterial: THREE.Material = aircraftDarkMaterial,
) {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), frameMaterial);
  const throat = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.62, depth * 0.16), throatMaterial);
  throat.position.z = -depth * 0.45;
  group.add(outer, throat);
  return group;
}

export function createNozzle(
  radius: number,
  length: number,
  petalCount = 12,
  detailed = true,
) {
  const group = new THREE.Group();
  group.name = detailed ? "aircraft-nozzle:detailed" : "aircraft-nozzle:simplified";
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.84, radius, length, Math.max(10, petalCount), 1, true),
    aircraftDarkMaterial,
  );
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);

  // Close the rear view with a recessed hot-section face and a positive rim.
  // An open cylinder alone reads as a missing polygon at High/Low distance.
  const hotFace = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.72, Math.max(10, petalCount)),
    aircraftDarkMaterial,
  );
  hotFace.position.z = length * 0.5 + 0.002;
  group.add(hotFace);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      radius * 0.84,
      radius * (detailed ? 0.045 : 0.07),
      detailed ? 6 : 4,
      Math.max(10, petalCount),
    ),
    aircraftPanelMaterial,
  );
  rim.position.z = length * 0.5 + 0.006;
  group.add(rim);

  if (detailed) {
    for (let index = 0; index < petalCount; index++) {
      const angle = index / petalCount * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.24, radius * 0.05, length * 0.68),
        aircraftPanelMaterial,
      );
      petal.position.set(
        Math.cos(angle) * radius * 0.91,
        Math.sin(angle) * radius * 0.91,
        length * 0.04,
      );
      // The broad face follows the circumference. Rotating the broad axis
      // radially makes every petal protrude like a spike in rear-quarter view.
      petal.rotation.z = angle + Math.PI / 2;
      group.add(petal);
    }
  }
  return group;
}

export function createStarGeometry(radius: number) {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index++) {
    const angle = Math.PI / 2 + index * Math.PI / 5;
    const r = index % 2 ? radius * 0.42 : radius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export function createNationalMarking(allegiance: "us" | "ussr", radius = 0.3) {
  const marking = new THREE.Group();
  if (allegiance === "us") {
    const white = new THREE.MeshStandardMaterial({ color: 0xe7ece8, roughness: 0.7 });
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshStandardMaterial({ color: 0x214c78, roughness: 0.68 }),
    );
    center.rotation.x = -Math.PI / 2;
    marking.add(center);
    const star = new THREE.Mesh(createStarGeometry(radius * 0.62), white);
    star.rotation.x = -Math.PI / 2;
    star.position.y = 0.008;
    marking.add(star);
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(radius, 0.018, radius * 0.42), white);
      bar.position.set(side * radius * 1.14, 0.006, 0);
      marking.add(bar);
    }
  } else {
    const border = new THREE.Mesh(
      createStarGeometry(radius),
      new THREE.MeshStandardMaterial({ color: 0xf2cf4b, roughness: 0.66 }),
    );
    border.rotation.x = -Math.PI / 2;
    marking.add(border);
    const star = new THREE.Mesh(
      createStarGeometry(radius * 0.84),
      new THREE.MeshStandardMaterial({ color: 0xc52228, roughness: 0.7 }),
    );
    star.rotation.x = -Math.PI / 2;
    star.position.y = 0.008;
    marking.add(star);
  }
  return marking;
}

export function addNavigationLight(
  root: THREE.Group,
  parent: THREE.Object3D,
  side: number,
  position: Vec3Tuple,
  radius = 0.065,
) {
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff473d : 0x54f58a }),
  );
  light.position.set(...position);
  parent.add(light);
  ((root.userData.formationLights ??= []) as THREE.Mesh[]).push(light);
  return light;
}

export function addPanelLine(
  parent: THREE.Object3D,
  position: Vec3Tuple,
  scale: Vec3Tuple,
  rotation: Vec3Tuple = [0, 0, 0],
) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), aircraftSeamMaterial);
  line.position.set(...position);
  line.scale.set(...scale);
  line.rotation.set(...rotation);
  line.castShadow = false;
  parent.add(line);
  return line;
}

export function airWeaponMounts(root: THREE.Group) {
  return (root.userData.airWeaponMounts ??= {}) as AirWeaponMountMap;
}

function addMountPieces(parent: THREE.Object3D, position: THREE.Vector3, pieces: readonly AirWeaponMountPiece[]) {
  const group = new THREE.Group();
  group.position.copy(position);
  for (const piece of pieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...piece.size), aircraftPanelMaterial);
    mesh.position.set(...piece.offset);
    mesh.castShadow = true;
    group.add(mesh);
  }
  parent.add(group);
  return group;
}

export function addAirWeaponMount(
  root: THREE.Group,
  parent: THREE.Object3D,
  id: string,
  aircraftPosition: Vec3Tuple,
  hardware: AirWeaponMountHardware,
) {
  root.updateMatrixWorld(true);
  const localPosition = parent.worldToLocal(root.localToWorld(new THREE.Vector3(...aircraftPosition)));
  const mount = new THREE.Group();
  mount.name = `air-weapon-mount:${id}`;
  mount.position.copy(localPosition);
  mount.userData.stationId = id;
  mount.userData.aircraftLocalPosition = [...aircraftPosition];
  parent.add(mount);
  airWeaponMounts(root)[id] = mount;
  const ultraHardware = addMountPieces(hardware.ultraParent, localPosition, hardware.ultraPieces);
  const highHardware = hardware.highParent
    ? addMountPieces(hardware.highParent, localPosition, hardware.highPieces ?? hardware.ultraPieces.slice(0, 1))
    : undefined;
  mount.userData.hardware = ultraHardware;
  mount.userData.hardwareTiers = [ultraHardware, highHardware].filter(Boolean);
  return mount;
}

export function finishAircraftModel(
  group: THREE.Group,
  tiers: AircraftModelTiers,
  options: FinishAircraftOptions,
) {
  group.rotation.order = "YXZ";
  group.userData.forwardAxis = "-Z";
  group.userData.modelLength = options.length;
  group.userData.realLengthMeters = options.realLengthMeters;
  group.userData.realWingspanMeters = options.realWingspanMeters;
  group.userData.modelMetersPerUnit = AIR_MODEL_METERS_PER_UNIT;
  group.userData.modelAssetVersion = AIRCRAFT_MODEL_ASSET_REVISION;
  group.userData.detailTags = [...options.detailTags];
  const tierMembers = group.userData.modelTierMembers as AircraftTierMembers;
  registerAssetDetailLod(group, {
    nearDistance: options.lodNear ?? 82,
    mediumDistance: options.lodMedium ?? 235,
    high: tierMembers.ultra,
    medium: tierMembers.high,
    low: tierMembers.low,
    exclusiveTiers: true,
    qualityAware: true,
  });

  const exhausts: THREE.Mesh[] = [];
  for (const position of options.engines) {
    const glow = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 1.55, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff9a45,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.copy(position);
    glow.position.z += 0.78;
    group.add(glow);
    exhausts.push(glow);
  }
  group.userData.exhausts = exhausts;

  const contrails: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.065, 1, 7, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xe8f2f2, transparent: true, opacity: 0, depthWrite: false }),
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.set(side * Math.max(0.8, options.length * 0.11), 0.02, options.length * 0.42 + 2.5);
    trail.visible = false;
    group.add(trail);
    contrails.push(trail);
  }
  group.userData.contrails = contrails;

  const damageSmoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x252a2b, transparent: true, opacity: 0, depthWrite: false }),
  );
  damageSmoke.position.set(0, 0.55, options.length * 0.18);
  damageSmoke.visible = false;
  group.add(damageSmoke);
  const damageFire = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff7a2f,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  damageFire.position.set(0, 0.3, options.length * 0.14);
  damageFire.visible = false;
  group.add(damageFire);
  const crashSplash = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xd9f2ed, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  crashSplash.rotation.x = -Math.PI / 2;
  crashSplash.position.y = -0.2;
  crashSplash.visible = false;
  group.add(crashSplash);
  group.userData.damageSmoke = damageSmoke;
  group.userData.damageFire = damageFire;
  group.userData.crashSplash = crashSplash;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = true;
  });
  return group;
}
