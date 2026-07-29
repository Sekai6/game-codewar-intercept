import * as THREE from "three";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dimensions.js";
import {
  addAirWeaponMount,
  addNavigationLight,
  addPanelLine,
  aircraftDarkMaterial,
  aircraftGlassMaterial,
  aircraftPaint,
  aircraftPanelMaterial,
  aircraftSeamMaterial,
  createAircraftTiers,
  createLoftedFuselage,
  createNationalMarking,
  createNozzle,
  createPlanform,
  createVerticalSurface,
  finishAircraftModel,
  type AirWeaponMountPiece,
  type FuselageStation,
  type Vec3Tuple,
} from "../model-kit.js";

type DetailTier = "ultra" | "high" | "low";
type StationClass = "outer-rail" | "middle-pylon" | "inner-ejector";

const dimensions = AIRCRAFT_REFERENCE_DIMENSIONS.MIG29A;
const length = dimensions.modelLength;
const halfLength = length * 0.5;
const halfSpan = dimensions.modelWingspan * 0.5;
const MAIN_WING_SWEEP_DEG = 42;
const LERX_SWEEP_DEG = 73.5;
const FIN_CANT_DEG = 6;
const MAIN_WING_CENTER_Y = 0;
const WEAPON_CONTACT_OVERLAP = 0.008;
const MOUNTED_WEAPON_ROLL = Math.PI * 0.25;

const airframePaint = aircraftPaint(0x87958e, 0.57, 0.12);
const undersidePaint = aircraftPaint(0x9da7a1, 0.62, 0.1);
const radomePaint = aircraftPaint(0x626c69, 0.68, 0.08);
const dielectricPaint = aircraftPaint(0x6b7772, 0.7, 0.08);
const hotSectionPaint = aircraftPaint(0x555d5b, 0.4, 0.18);
const intakePaint = aircraftPaint(0x74817c, 0.55, 0.12);
const cockpitInteriorPaint = aircraftPaint(0x343b39, 0.74, 0.04);
const lowGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x18343e,
  metalness: 0.12,
  roughness: 0.32,
});
const sensorGlassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x171f20,
  metalness: 0.1,
  roughness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
});

export const MIG29A_MODEL_STATIONS = [
  { id: "wing-port-outer", position: [-2.48, -0.31, 0.9] as Vec3Tuple, stationClass: "outer-rail" as StationClass },
  { id: "wing-port-middle", position: [-1.82, -0.36, 0.55] as Vec3Tuple, stationClass: "middle-pylon" as StationClass },
  { id: "wing-port-inner", position: [-1.18, -0.4, 0.12] as Vec3Tuple, stationClass: "inner-ejector" as StationClass },
  { id: "wing-starboard-outer", position: [2.48, -0.31, 0.9] as Vec3Tuple, stationClass: "outer-rail" as StationClass },
  { id: "wing-starboard-middle", position: [1.82, -0.36, 0.55] as Vec3Tuple, stationClass: "middle-pylon" as StationClass },
  { id: "wing-starboard-inner", position: [1.18, -0.4, 0.12] as Vec3Tuple, stationClass: "inner-ejector" as StationClass },
] as const;

function radomeStations(): readonly FuselageStation[] {
  return [
    { z: -halfLength, radiusX: 0.012, radiusY: 0.01, centerY: -0.04 },
    { z: -3.95, radiusX: 0.17, radiusY: 0.145, centerY: -0.035 },
    { z: -3.55, radiusX: 0.32, radiusY: 0.255, centerY: -0.005 },
    { z: -3.08, radiusX: 0.46, radiusY: 0.35, centerY: 0.035 },
  ];
}

function centralFuselageStations(): readonly FuselageStation[] {
  return [
    { z: -3.08, radiusX: 0.46, radiusY: 0.35, centerY: 0.035 },
    { z: -2.62, radiusX: 0.5, radiusY: 0.41, centerY: 0.075 },
    { z: -2.05, radiusX: 0.53, radiusY: 0.43, centerY: 0.08 },
    { z: -1.42, radiusX: 0.56, radiusY: 0.41, centerY: 0.045 },
    { z: -0.62, radiusX: 0.57, radiusY: 0.35, centerY: 0.01 },
    { z: 0.48, radiusX: 0.53, radiusY: 0.31, centerY: -0.015 },
    { z: 1.62, radiusX: 0.45, radiusY: 0.27, centerY: -0.005 },
    { z: 2.65, radiusX: 0.34, radiusY: 0.23, centerY: 0.015 },
    { z: 3.32, radiusX: 0.2, radiusY: 0.145, centerY: 0.035 },
    { z: 3.62, radiusX: 0.11, radiusY: 0.08, centerY: 0.065 },
  ];
}

function tailBoomStations(): readonly FuselageStation[] {
  return [
    { z: 2.45, radiusX: 0.235, radiusY: 0.135, centerY: 0.2 },
    { z: 3.08, radiusX: 0.205, radiusY: 0.125, centerY: 0.205 },
    { z: 3.62, radiusX: 0.15, radiusY: 0.105, centerY: 0.2 },
    { z: 4.08, radiusX: 0.085, radiusY: 0.07, centerY: 0.185 },
    { z: halfLength, radiusX: 0.018, radiusY: 0.014, centerY: 0.17 },
  ];
}

function engineNacelleStations(): readonly FuselageStation[] {
  return [
    { z: -1.5, radiusX: 0.3, radiusY: 0.22, centerY: -0.17 },
    { z: -1.2, radiusX: 0.42, radiusY: 0.32, centerY: -0.18 },
    { z: -0.55, radiusX: 0.46, radiusY: 0.36, centerY: -0.17 },
    { z: 0.45, radiusX: 0.47, radiusY: 0.37, centerY: -0.15 },
    { z: 1.55, radiusX: 0.45, radiusY: 0.35, centerY: -0.13 },
    { z: 2.55, radiusX: 0.41, radiusY: 0.32, centerY: -0.11 },
    { z: 3.35, radiusX: 0.36, radiusY: 0.29, centerY: -0.1 },
    { z: 3.78, radiusX: 0.33, radiusY: 0.28, centerY: -0.09 },
  ];
}

function engineShoulderStations(): readonly FuselageStation[] {
  return [
    { z: -1.72, radiusX: 0.16, radiusY: 0.055, centerY: 0.055 },
    { z: -1.32, radiusX: 0.34, radiusY: 0.12, centerY: 0.075 },
    { z: -0.45, radiusX: 0.43, radiusY: 0.16, centerY: 0.07 },
    { z: 0.65, radiusX: 0.45, radiusY: 0.17, centerY: 0.06 },
    { z: 1.65, radiusX: 0.42, radiusY: 0.15, centerY: 0.045 },
    { z: 2.55, radiusX: 0.34, radiusY: 0.12, centerY: 0.02 },
    { z: 3.12, radiusX: 0.19, radiusY: 0.07, centerY: -0.005 },
  ];
}

function dorsalSpineStations(): readonly FuselageStation[] {
  return [
    { z: -1.74, radiusX: 0.23, radiusY: 0.11, centerY: 0.35 },
    { z: -1.42, radiusX: 0.3, radiusY: 0.16, centerY: 0.34 },
    { z: -0.7, radiusX: 0.32, radiusY: 0.17, centerY: 0.28 },
    { z: 0.2, radiusX: 0.3, radiusY: 0.15, centerY: 0.24 },
    { z: 1.12, radiusX: 0.25, radiusY: 0.12, centerY: 0.2 },
    { z: 1.9, radiusX: 0.17, radiusY: 0.075, centerY: 0.15 },
  ];
}

function canopyStations(): readonly FuselageStation[] {
  return [
    { z: -2.85, radiusX: 0.09, radiusY: 0.055, centerY: 0.43 },
    { z: -2.7, radiusX: 0.22, radiusY: 0.13, centerY: 0.47 },
    { z: -2.42, radiusX: 0.3, radiusY: 0.22, centerY: 0.49 },
    { z: -2.08, radiusX: 0.29, radiusY: 0.21, centerY: 0.48 },
    { z: -1.82, radiusX: 0.21, radiusY: 0.13, centerY: 0.43 },
    { z: -1.7, radiusX: 0.08, radiusY: 0.05, centerY: 0.38 },
  ];
}

function tierSegments(tier: DetailTier) {
  return tier === "ultra" ? 96 : tier === "high" ? 44 : 14;
}

function mainWingThickness(tier: DetailTier) {
  return tier === "ultra" ? 0.115 : tier === "high" ? 0.085 : 0.06;
}

function mainWingUndersideY(tier: DetailTier) {
  return MAIN_WING_CENTER_Y - mainWingThickness(tier) * 0.5;
}

function addCanopy(parent: THREE.Group, tier: DetailTier) {
  const material = tier === "low" ? lowGlassMaterial : aircraftGlassMaterial;
  const canopy = createLoftedFuselage(canopyStations(), material, tier === "ultra" ? 48 : tier === "high" ? 24 : 10);
  canopy.name = `mig29-single-seat-canopy:${tier}`;
  parent.add(canopy);
  if (tier === "low") return;
  const windscreenBow = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, tier === "ultra" ? 0.012 : 0.017, 5, tier === "ultra" ? 40 : 24),
    aircraftSeamMaterial,
  );
  windscreenBow.scale.y = 0.72;
  windscreenBow.position.set(0, 0.485, -2.61);
  parent.add(windscreenBow);
  if (tier === "ultra") {
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.07), cockpitInteriorPaint);
    seatBack.position.set(0, 0.35, -1.98);
    seatBack.rotation.x = -0.18;
    parent.add(seatBack);
    const seatPan = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.17), cockpitInteriorPaint);
    seatPan.position.set(0, 0.265, -2.1);
    parent.add(seatPan);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.055), cockpitInteriorPaint);
    headrest.position.set(0, 0.46, -1.94);
    parent.add(headrest);
  }
}

function trapezoidShape(topWidth: number, bottomWidth: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-bottomWidth * 0.5, -height * 0.5);
  shape.lineTo(bottomWidth * 0.5, -height * 0.5);
  shape.lineTo(topWidth * 0.5, height * 0.5);
  shape.lineTo(-topWidth * 0.5, height * 0.5);
  shape.closePath();
  return shape;
}

function createTrapezoidIntakeDuct(
  topWidth: number,
  bottomWidth: number,
  height: number,
  depth: number,
  lip: number,
) {
  const outer = trapezoidShape(topWidth, bottomWidth, height);
  const inner = trapezoidShape(topWidth - lip * 2, bottomWidth - lip * 2, height - lip * 2);
  outer.holes.push(inner);
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, intakePaint);
}

function addIntake(parent: THREE.Group, side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `mig29-intake:${side < 0 ? "port" : "starboard"}:${tier}`;
  group.position.set(side * 0.84, -0.24, -1.24);
  group.rotation.y = side * -0.025;
  group.rotation.x = 0.035;
  const topWidth = tier === "low" ? 0.49 : 0.56;
  const bottomWidth = tier === "low" ? 0.41 : 0.47;
  const height = tier === "low" ? 0.32 : 0.38;
  const depth = tier === "ultra" ? 0.66 : tier === "high" ? 0.54 : 0.38;
  const lip = tier === "ultra" ? 0.045 : 0.06;
  group.add(createTrapezoidIntakeDuct(topWidth, bottomWidth, height, depth, lip));
  const throat = new THREE.Mesh(
    new THREE.ShapeGeometry(trapezoidShape(topWidth - lip * 2.3, bottomWidth - lip * 2.3, height - lip * 2.3)),
    aircraftDarkMaterial,
  );
  throat.position.z = depth * 0.5 + 0.004;
  throat.rotation.y = Math.PI;
  group.add(throat);
  if (tier !== "low") {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(topWidth * 0.72, 0.025, depth * 0.62), aircraftPanelMaterial);
    ramp.position.set(0, height * 0.27, 0.02);
    ramp.rotation.x = 0.08;
    group.add(ramp);
  }
  if (tier === "ultra") {
    const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 20), hotSectionPaint);
    fanHub.rotation.x = Math.PI / 2;
    fanHub.position.z = depth * 0.5 - 0.01;
    group.add(fanHub);
    for (let index = 0; index < 12; index++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.18, 0.012), hotSectionPaint);
      blade.position.z = depth * 0.5 - 0.018;
      blade.rotation.z = index / 12 * Math.PI * 2;
      group.add(blade);
    }
  }
  parent.add(group);
}

function addAuxiliaryIntakeDoors(parent: THREE.Group, side: number, tier: DetailTier) {
  if (tier === "low") return;
  const doorMaterial = tier === "ultra" ? intakePaint : aircraftPanelMaterial;
  const count = tier === "ultra" ? 5 : 3;
  for (let index = 0; index < count; index++) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(tier === "ultra" ? 0.39 : 0.4, 0.012, tier === "ultra" ? 0.075 : 0.12),
      doorMaterial,
    );
    door.position.set(side * 0.84, 0.215, tier === "ultra" ? -1.3 + index * 0.098 : -1.23 + index * 0.155);
    door.rotation.y = side * -0.025;
    door.rotation.x = -0.045;
    parent.add(door);
    if (tier === "ultra") {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.012), aircraftSeamMaterial);
      hinge.position.set(side * 0.84, 0.221, -1.335 + index * 0.098);
      hinge.rotation.y = side * -0.025;
      parent.add(hinge);
    }
  }
}

function addWingAndLerx(parent: THREE.Group, tier: DetailTier, surfaceMarkings: THREE.Object3D[]) {
  const thickness = mainWingThickness(tier);
  const wingRootX = 0.74;
  const wingRootLeadingZ = -0.72;
  const wingTipLeadingZ = wingRootLeadingZ
    + Math.tan(THREE.MathUtils.degToRad(MAIN_WING_SWEEP_DEG)) * (halfSpan - wingRootX);
  const centerDeck = createPlanform([
    [-0.28, -2.56],
    [-0.46, -1.48],
    [-0.58, 0.72],
    [-0.47, 2.5],
    [0.47, 2.5],
    [0.58, 0.72],
    [0.46, -1.48],
    [0.28, -2.56],
  ], tier === "low" ? undersidePaint : airframePaint, thickness * 1.65);
  centerDeck.position.y = -0.025;
  centerDeck.name = `mig29-continuous-center-deck:${tier}`;
  parent.add(centerDeck);
  for (const side of [-1, 1]) {
    const lerxPoints = tier === "ultra" ? [
      [side * 0.24, -2.6],
      [side * 0.5, -1.72],
      [side * 0.73, -0.95],
      [side * 0.82, 0.78],
      [side * 0.75, 1.55],
      [side * 0.46, 0.98],
    ] as const : tier === "high" ? [
      [side * 0.25, -2.58],
      [side * 0.53, -1.6],
      [side * 0.8, -0.72],
      [side * 0.76, 1.48],
      [side * 0.47, 1.0],
    ] as const : [
      [side * 0.27, -2.5],
      [side * 0.79, -0.72],
      [side * 0.74, 1.38],
      [side * 0.48, 0.96],
    ] as const;
    const lerx = createPlanform(lerxPoints, tier === "low" ? undersidePaint : airframePaint, thickness * 1.28);
    lerx.position.y = 0.005;
    lerx.name = `mig29-73.5deg-lerx:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(lerx);
    const wing = createPlanform([
      [side * wingRootX, wingRootLeadingZ],
      [side * halfSpan, wingTipLeadingZ],
      [side * halfSpan, wingTipLeadingZ + 0.44],
      [side * 0.78, 1.55],
    ], tier === "low" ? undersidePaint : airframePaint, thickness);
    wing.name = `mig29-42deg-main-wing:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(wing);
    if (tier !== "low") {
      const marking = createNationalMarking("ussr", tier === "ultra" ? 0.215 : 0.19);
      marking.position.set(side * 1.88, thickness * 0.56, 0.67);
      parent.add(marking);
      surfaceMarkings.push(marking);
    }
    if (tier === "ultra") {
      addPanelLine(parent, [side * 1.55, thickness * 0.58, 0.42], [1.0, 0.011, 0.022], [0, side * 0.33, 0]);
      addPanelLine(parent, [side * 2.38, thickness * 0.58, 1.15], [0.45, 0.011, 0.02], [0, side * 0.18, 0]);
    }
  }
}

function addTailSurfaces(parent: THREE.Group, tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.085 : tier === "high" ? 0.065 : 0.045;
  for (const side of [-1, 1]) {
    const fin = createVerticalSurface([
      [-0.68, 0],
      [0.48, 1.69],
      [0.94, 1.63],
      [1.08, 0],
    ], thickness, tier === "low" ? undersidePaint : airframePaint);
    fin.name = `mig29-6deg-canted-fin:${side < 0 ? "port" : "starboard"}:${tier}`;
    fin.position.set(side * 0.82, 0.15, 2.62);
    fin.rotation.z = side * -THREE.MathUtils.degToRad(FIN_CANT_DEG);
    parent.add(fin);
    const dielectricCap = createVerticalSurface([
      [0.39, 1.56],
      [0.48, 1.69],
      [0.94, 1.63],
      [0.91, 1.49],
    ], thickness * 1.04, dielectricPaint);
    dielectricCap.position.copy(fin.position);
    dielectricCap.rotation.copy(fin.rotation);
    if (tier !== "low") parent.add(dielectricCap);
    const stabilator = createPlanform([
      [side * 0.53, 2.46],
      [side * 1.945, 4.02],
      [side * 1.82, halfLength],
      [side * 0.55, 3.5],
    ], tier === "low" ? undersidePaint : airframePaint, thickness * 0.72);
    stabilator.position.y = -0.05;
    stabilator.name = `mig29-stabilator:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(stabilator);
  }
}

function addVentralStrakes(parent: THREE.Group, tier: DetailTier) {
  const depth = tier === "ultra" ? 0.25 : tier === "high" ? 0.22 : 0.18;
  for (const side of [-1, 1]) {
    const strake = createVerticalSurface([
      [2.7, 0],
      [3.12, -depth],
      [3.72, -depth * 0.78],
      [3.9, 0],
    ], tier === "ultra" ? 0.045 : tier === "high" ? 0.035 : 0.025, tier === "low" ? undersidePaint : airframePaint);
    strake.position.set(side * 0.62, -0.27, 0);
    strake.name = `mig29-ventral-strake:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(strake);
  }
}

function addIrsSensor(parent: THREE.Group, tier: DetailTier) {
  if (tier === "low") return;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.075, tier === "ultra" ? 16 : 10),
    aircraftPanelMaterial,
  );
  base.position.set(0.18, 0.39, -2.91);
  parent.add(base);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, tier === "ultra" ? 28 : 12, tier === "ultra" ? 16 : 7, 0, Math.PI * 2, 0, Math.PI * 0.58),
    sensorGlassMaterial,
  );
  dome.position.set(0.18, 0.445, -2.91);
  parent.add(dome);
}

function addStaticAirframe(parent: THREE.Group, tier: DetailTier, surfaceMarkings: THREE.Object3D[]) {
  const segments = tierSegments(tier);
  const radome = createLoftedFuselage(radomeStations(), radomePaint, segments);
  radome.name = `mig29-ogive-radome:${tier}`;
  parent.add(radome);
  const fuselage = createLoftedFuselage(centralFuselageStations(), airframePaint, segments);
  fuselage.name = `mig29-wide-central-fuselage:${tier}`;
  parent.add(fuselage);
  const tailBoom = createLoftedFuselage(tailBoomStations(), tier === "low" ? undersidePaint : airframePaint, segments);
  tailBoom.name = `mig29-drag-chute-tail-boom:${tier}`;
  parent.add(tailBoom);
  addWingAndLerx(parent, tier, surfaceMarkings);
  const dorsalSpine = createLoftedFuselage(dorsalSpineStations(), tier === "low" ? undersidePaint : airframePaint, segments);
  dorsalSpine.name = `mig29-continuous-dorsal-spine:${tier}`;
  parent.add(dorsalSpine);
  for (const side of [-1, 1]) {
    const shoulder = createLoftedFuselage(engineShoulderStations(), tier === "low" ? undersidePaint : airframePaint, segments);
    shoulder.name = `mig29-engine-shoulder-blend:${side < 0 ? "port" : "starboard"}:${tier}`;
    shoulder.position.x = side * 0.8;
    parent.add(shoulder);
    const nacelle = createLoftedFuselage(engineNacelleStations(), hotSectionPaint, segments);
    nacelle.name = `mig29-independent-engine-channel:${side < 0 ? "port" : "starboard"}:${tier}`;
    nacelle.position.x = side * 0.86;
    parent.add(nacelle);
    addIntake(parent, side, tier);
    addAuxiliaryIntakeDoors(parent, side, tier);
    const nozzle = createNozzle(0.35, 0.58, tier === "ultra" ? 16 : tier === "high" ? 12 : 10, tier === "ultra");
    nozzle.position.set(side * 0.86, -0.1, 3.77);
    parent.add(nozzle);
  }
  addCanopy(parent, tier);
  addTailSurfaces(parent, tier);
  addVentralStrakes(parent, tier);
  addIrsSensor(parent, tier);
  if (tier !== "low") {
    const radomeSeam = new THREE.Mesh(
      new THREE.TorusGeometry(0.455, tier === "ultra" ? 0.004 : 0.006, 4, tier === "ultra" ? 32 : 20),
      aircraftSeamMaterial,
    );
    radomeSeam.scale.y = 0.76;
    radomeSeam.position.set(0, 0.035, -3.08);
    parent.add(radomeSeam);
  }
  if (tier === "ultra") {
    for (const z of [-1.48, -0.56, 0.52, 1.55]) {
      addPanelLine(parent, [0, 0.375, z], [0.43, 0.012, 0.018]);
    }
    const dorsalAntenna = createVerticalSurface([
      [-0.13, 0],
      [0.03, 0.24],
      [0.19, 0],
    ], 0.035, dielectricPaint);
    dorsalAntenna.position.set(0, 0.3, -1.42);
    parent.add(dorsalAntenna);
  }
}

interface MountPieceSet {
  ultra: readonly AirWeaponMountPiece[];
  high: readonly AirWeaponMountPiece[];
}

function mountContactY(pieces: readonly AirWeaponMountPiece[]) {
  return Math.min(...pieces.map((piece) => piece.offset[1] - piece.size[1] * 0.5));
}

function connectingPiece(
  x: number,
  z: number,
  width: number,
  depth: number,
  lowerY: number,
  upperY: number,
): AirWeaponMountPiece {
  return {
    offset: [x, (lowerY + upperY) * 0.5, z],
    size: [width, upperY - lowerY, depth],
  };
}

function mountPieces(stationClass: StationClass, side: number, stationY: number): MountPieceSet {
  if (stationClass === "outer-rail") {
    const ultraContactY = 0.035;
    const ultraRailHeight = 0.04;
    const ultraRailTop = ultraContactY + ultraRailHeight;
    const ultraPylonBottom = 0.055;
    const ultraPylonTop = mainWingUndersideY("ultra") - stationY;
    const highContactY = ultraContactY;
    const highRailHeight = 0.075;
    const highRailTop = highContactY + highRailHeight;
    const highPylonTop = mainWingUndersideY("high") - stationY;
    return {
      ultra: [
        { offset: [0, ultraContactY + ultraRailHeight * 0.5, 0], size: [0.075, ultraRailHeight, 0.76] },
        connectingPiece(side * -0.025, -0.05, 0.08, 0.3, ultraPylonBottom, ultraPylonTop),
      ],
      high: [
        { offset: [0, highContactY + highRailHeight * 0.5, 0], size: [0.085, highRailHeight, 0.69] },
        connectingPiece(side * -0.02, -0.04, 0.085, 0.27, highRailTop, highPylonTop),
      ],
    };
  }
  if (stationClass === "middle-pylon") {
    const contactY = 0.0475;
    const highRailHeight = 0.105;
    const highRailTop = contactY + highRailHeight;
    const highPylonTop = mainWingUndersideY("high") - stationY;
    return {
      ultra: [
        { offset: [0, 0.075, 0], size: [0.105, 0.055, 0.88] },
        { offset: [0, 0.19, -0.1], size: [0.135, 0.24, 0.4] },
        { offset: [side * -0.06, 0.28, -0.04], size: [0.06, 0.09, 0.52] },
      ],
      high: [
        { offset: [0, contactY + highRailHeight * 0.5, 0], size: [0.12, highRailHeight, 0.8] },
        connectingPiece(0, -0.08, 0.12, 0.34, highRailTop, highPylonTop),
      ],
    };
  }
  const contactY = 0.05;
  const highRailHeight = 0.12;
  const highRailTop = contactY + highRailHeight;
  const highPylonTop = mainWingUndersideY("high") - stationY;
  return {
    ultra: [
      { offset: [0, 0.08, 0], size: [0.12, 0.06, 0.92] },
      { offset: [0, 0.21, -0.12], size: [0.15, 0.25, 0.44] },
      { offset: [side * -0.075, 0.31, -0.02], size: [0.065, 0.105, 0.56] },
    ],
    high: [
      { offset: [0, contactY + highRailHeight * 0.5, 0], size: [0.125, highRailHeight, 0.82] },
      connectingPiece(0, -0.1, 0.135, 0.36, highRailTop, highPylonTop),
    ],
  };
}

function addLowMountHardware(
  parent: THREE.Group,
  position: Vec3Tuple,
  stationClass: StationClass,
  contactY: number,
) {
  const outerRail = stationClass === "outer-rail";
  const railHeight = outerRail ? 0.06 : 0.12;
  const railWidth = outerRail ? 0.075 : 0.12;
  const railDepth = outerRail ? 0.64 : 0.74;
  const railTop = contactY + railHeight;
  const pylonTop = mainWingUndersideY("low") - position[1];
  const group = new THREE.Group();
  group.position.set(...position);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(railWidth, railHeight, railDepth),
    aircraftPanelMaterial,
  );
  rail.position.y = contactY + railHeight * 0.5;
  group.add(rail);
  const pylon = new THREE.Mesh(
    new THREE.BoxGeometry(outerRail ? 0.075 : 0.115, pylonTop - railTop, outerRail ? 0.25 : 0.32),
    aircraftPanelMaterial,
  );
  pylon.position.set(outerRail ? Math.sign(position[0]) * -0.02 : 0, (railTop + pylonTop) * 0.5, outerRail ? -0.04 : -0.08);
  group.add(pylon);
  parent.add(group);
}

function addPitot(root: THREE.Group) {
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.36, 7), aircraftSeamMaterial);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0, -0.035, -halfLength + 0.18);
  root.add(pitot);
}

export function createMig29Model() {
  const root = new THREE.Group();
  root.name = "MiG-29A Fulcrum-A visual rig";
  const tiers = createAircraftTiers(root);
  const surfaceMarkings: THREE.Object3D[] = [];
  addStaticAirframe(tiers.ultra, "ultra", surfaceMarkings);
  addStaticAirframe(tiers.high, "high", surfaceMarkings);
  addStaticAirframe(tiers.low, "low", surfaceMarkings);

  for (const side of [-1, 1]) {
    addNavigationLight(root, root, side, [side * (halfSpan - 0.035), 0.035, 1.28], 0.052);
  }
  addPitot(root);

  const weaponRig = new THREE.Group();
  weaponRig.name = "mig29-wing-weapon-rig";
  root.add(weaponRig);
  for (const station of MIG29A_MODEL_STATIONS) {
    const side = Math.sign(station.position[0]);
    const pieces = mountPieces(station.stationClass, side, station.position[1]);
    const mount = addAirWeaponMount(root, weaponRig, station.id, station.position, {
      ultraParent: tiers.ultra,
      highParent: tiers.high,
      ultraPieces: pieces.ultra,
      highPieces: pieces.high,
    });
    const contactY = mountContactY(pieces.ultra);
    mount.userData.weaponUpperContactY = contactY;
    mount.userData.weaponContactOverlap = WEAPON_CONTACT_OVERLAP;
    mount.userData.weaponRoll = MOUNTED_WEAPON_ROLL;
    mount.userData.weaponContactSource = "ultra-hardware-aabb-lower-face";
    addLowMountHardware(tiers.low, station.position, station.stationClass, contactY);
  }

  root.userData.surfaceMarkings = surfaceMarkings;
  root.userData.mainWingSweepDeg = MAIN_WING_SWEEP_DEG;
  root.userData.lerxSweepDeg = LERX_SWEEP_DEG;
  root.userData.verticalTailCantDeg = FIN_CANT_DEG;
  root.userData.weaponStationPositions = Object.fromEntries(
    MIG29A_MODEL_STATIONS.map((station) => [station.id, [...station.position]]),
  );
  tiers.ultra.visible = true;
  tiers.high.visible = false;
  tiers.low.visible = false;
  const finished = finishAircraftModel(root, tiers, {
    length,
    realLengthMeters: dimensions.realLengthMeters,
    realWingspanMeters: dimensions.realWingspanMeters,
    engines: [
      new THREE.Vector3(-0.86, -0.1, 3.96),
      new THREE.Vector3(0.86, -0.1, 3.96),
    ],
    detailTags: [
      "single-seat-canopy",
      "ogive-radome",
      "73.5-degree-lerx",
      "42-degree-main-wing",
      "lerx",
      "twin-nacelles",
      "independent-engine-channels",
      "separate-intakes",
      "auxiliary-intake-doors",
      "canted-twin-tails",
      "6-degree-tail-cant",
      "stabilators",
      "irst",
      "three-pylon-types",
    ],
    lodNear: 82,
    lodMedium: 235,
  });
  finished.userData.referenceDimensions = dimensions;
  return finished;
}
