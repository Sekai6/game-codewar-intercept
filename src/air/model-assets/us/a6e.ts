import * as THREE from "three";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dimensions.js";
import { A6E_PYLON_STATIONS, A6E_STRIKE_STATIONS, type A6EPylonStation } from "./a6e-stations.js";
import {
  addAirWeaponMount,
  addNavigationLight,
  addPanelLine,
  aircraftDarkMaterial,
  aircraftGlassMaterial,
  aircraftPaint,
  aircraftPanelMaterial,
  createAircraftTiers,
  createLoftedFuselage,
  createNationalMarking,
  createNozzle,
  createPlanform,
  createVerticalSurface,
  finishAircraftModel,
  type FuselageStation,
} from "../model-kit.js";
import {
  configureSurfaceMarking,
  createBeveledPlanform,
  createTaperedPylon,
  TAPERED_PYLON_RAIL_BOTTOM_Y,
} from "./geometry.js";

type DetailTier = "ultra" | "high" | "low";

const dimensions = AIRCRAFT_REFERENCE_DIMENSIONS.A6E;
const length = dimensions.modelLength;
const halfLength = length * 0.5;
const halfSpan = dimensions.modelWingspan * 0.5;

const fuselagePaint = aircraftPaint(0x8d9898, 0.52, 0.14);
const undersidePaint = aircraftPaint(0xb2b7b3, 0.58, 0.1);
const radomePaint = aircraftPaint(0x6f7978, 0.6, 0.08);
const intakePaint = aircraftPaint(0x7c8786, 0.51, 0.13);
const tramPaint = aircraftPaint(0x7c8784, 0.54, 0.1);
const cockpitSeatPaint = aircraftPaint(0x35474a, 0.66, 0.04);
const cockpitHeadrestPaint = aircraftPaint(0x4c5955, 0.72, 0.03);

function radomeStations(): readonly FuselageStation[] {
  return [
    { z: -halfLength, radiusX: 0.025, radiusY: 0.02, centerY: -0.1 },
    { z: -halfLength + 0.08, radiusX: 0.18, radiusY: 0.14, centerY: -0.1 },
    { z: -halfLength + 0.22, radiusX: 0.37, radiusY: 0.29, centerY: -0.085 },
    { z: -3.72, radiusX: 0.58, radiusY: 0.43, centerY: -0.035 },
    { z: -3.42, radiusX: 0.72, radiusY: 0.52, centerY: 0.015 },
    { z: -3.2, radiusX: 0.78, radiusY: 0.56, centerY: 0.04 },
  ];
}

function fuselageStations(): readonly FuselageStation[] {
  return [
    { z: -3.2, radiusX: 0.78, radiusY: 0.54, centerY: 0.05 },
    { z: -2.65, radiusX: 0.88, radiusY: 0.6, centerY: 0.08 },
    { z: -1.7, radiusX: 0.83, radiusY: 0.56, centerY: 0.07 },
    { z: -0.55, radiusX: 0.75, radiusY: 0.5, centerY: 0.06 },
    { z: 0.75, radiusX: 0.67, radiusY: 0.44, centerY: 0.07 },
    { z: 1.95, radiusX: 0.56, radiusY: 0.36, centerY: 0.09 },
    { z: 2.95, radiusX: 0.41, radiusY: 0.26, centerY: 0.12 },
    { z: 3.72, radiusX: 0.23, radiusY: 0.14, centerY: 0.14 },
    { z: halfLength, radiusX: 0.02, radiusY: 0.02, centerY: 0.14 },
  ];
}

function createDShape(width: number, height: number, depth: number, segments: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.48, -height * 0.5);
  shape.lineTo(width * 0.08, -height * 0.5);
  for (let index = 0; index <= segments; index++) {
    const angle = -Math.PI * 0.5 + index / segments * Math.PI;
    shape.lineTo(width * 0.08 + Math.cos(angle) * width * 0.42, Math.sin(angle) * height * 0.5);
  }
  shape.lineTo(-width * 0.48, height * 0.5);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

function addShoulderIntake(parent: THREE.Group, side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `a6-d-shoulder-intake:${side < 0 ? "port" : "starboard"}:${tier}`;
  group.position.set(side * 0.74, 0.06, -2.13);
  group.scale.x = side;
  const width = tier === "low" ? 0.42 : 0.52;
  const height = tier === "low" ? 0.36 : 0.45;
  const depth = tier === "ultra" ? 0.22 : 0.16;
  const lip = new THREE.Mesh(createDShape(width, height, depth, tier === "ultra" ? 14 : 8), intakePaint);
  group.add(lip);
  const throat = new THREE.Mesh(
    createDShape(width * 0.76, height * 0.72, 0.025, tier === "ultra" ? 12 : 7),
    aircraftDarkMaterial,
  );
  throat.position.z = -depth * 0.55;
  group.add(throat);
  if (tier !== "low") {
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.045, height * 0.88, depth * 1.6), undersidePaint);
    splitter.position.set(-width * 0.42, 0, 0.02);
    group.add(splitter);
  }
  parent.add(group);
}

function addShoulderFairing(parent: THREE.Group, side: number, tier: DetailTier) {
  const segments = tier === "ultra" ? 24 : tier === "high" ? 14 : 8;
  const fairing = createLoftedFuselage([
    { z: -2.18, radiusX: 0.24, radiusY: 0.24, centerY: 0.015 },
    { z: -1.72, radiusX: 0.39, radiusY: 0.34, centerY: 0 },
    { z: -0.65, radiusX: 0.4, radiusY: 0.35, centerY: -0.02 },
    { z: 0.75, radiusX: 0.34, radiusY: 0.31, centerY: -0.035 },
    { z: 1.95, radiusX: 0.24, radiusY: 0.24, centerY: -0.02 },
    { z: 2.65, radiusX: 0.11, radiusY: 0.13, centerY: 0 },
  ], intakePaint, segments);
  fairing.name = `a6-engine-shoulder-fairing:${side < 0 ? "port" : "starboard"}:${tier}`;
  fairing.position.x = side * 0.73;
  parent.add(fairing);
}

function addCanopy(parent: THREE.Group, tier: DetailTier) {
  const canopy = createLoftedFuselage([
    { z: -3.2, radiusX: 0.08, radiusY: 0.04, centerY: 0.45 },
    { z: -3.0, radiusX: 0.43, radiusY: 0.17, centerY: 0.56 },
    { z: -2.62, radiusX: 0.59, radiusY: 0.27, centerY: 0.58 },
    { z: -2.2, radiusX: 0.56, radiusY: 0.24, centerY: 0.56 },
    { z: -1.86, radiusX: 0.12, radiusY: 0.05, centerY: 0.43 },
  ], aircraftGlassMaterial, tier === "ultra" ? 28 : tier === "high" ? 18 : 10);
  canopy.name = `a6-side-by-side-canopy:${tier}`;
  parent.add(canopy);
  if (tier === "low") return;
  const centerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 1.05), aircraftPanelMaterial);
  centerFrame.position.set(0, 0.76, -2.55);
  parent.add(centerFrame);
  for (const [z, width, y] of [[-3.0, 0.76, 0.68], [-2.18, 0.88, 0.7]] as const) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.04), aircraftPanelMaterial);
    bow.position.set(0, y, z);
    parent.add(bow);
  }
  if (tier === "ultra") {
    for (const x of [-0.3, 0.3]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.32), cockpitSeatPaint);
      seat.name = `a6-cockpit-seat:${x < 0 ? "port" : "starboard"}`;
      seat.position.set(x * 0.8, 0.39, -2.48);
      parent.add(seat);
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.1), cockpitHeadrestPaint);
      headrest.name = `a6-cockpit-headrest:${x < 0 ? "port" : "starboard"}`;
      headrest.position.set(x * 0.8, 0.5, -2.39);
      parent.add(headrest);
    }
  }
}

function addTramTurret(parent: THREE.Group, tier: DetailTier) {
  const turret = new THREE.Group();
  turret.name = `a6e-tram-turret:${tier}`;
  turret.position.set(0, -0.43, -3.05);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.13, 0.07, tier === "ultra" ? 20 : tier === "high" ? 12 : 8),
    undersidePaint,
  );
  collar.name = `a6e-tram-collar:${tier}`;
  collar.position.y = 0.055;
  turret.add(collar);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, tier === "ultra" ? 22 : tier === "high" ? 14 : 8, tier === "ultra" ? 14 : 8),
    tramPaint,
  );
  shell.name = `a6e-tram-shell:${tier}`;
  shell.scale.set(1, 0.78, 0.9);
  turret.add(shell);
  if (tier !== "low") {
    const window = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, tier === "ultra" ? 18 : 10),
      aircraftGlassMaterial.clone(),
    );
    window.name = `a6e-tram-window:${tier}`;
    window.material.side = THREE.DoubleSide;
    window.scale.set(0.78, 0.56, 1);
    window.position.set(0, -0.022, -0.096);
    window.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, -0.28, -0.96).normalize(),
    );
    turret.add(window);
  }
  parent.add(turret);
}

function wingPoints(side: number) {
  return [
    [side * 0.55, -1.48],
    [side * halfSpan, -0.18],
    [side * halfSpan, 0.52],
    [side * 0.55, 0.92],
  ] as const;
}

function addWing(parent: THREE.Group, side: number, tier: DetailTier, markings: THREE.Object3D[]) {
  const thickness = tier === "ultra" ? 0.13 : tier === "high" ? 0.095 : 0.065;
  const wing = tier === "ultra"
    ? createBeveledPlanform(wingPoints(side), fuselagePaint, thickness, 0.035, 2)
    : createPlanform(wingPoints(side), tier === "low" ? undersidePaint : fuselagePaint, thickness);
  wing.name = `a6-folding-wing:${side < 0 ? "port" : "starboard"}:${tier}`;
  wing.position.y = 0.22;
  parent.add(wing);

  if (tier !== "low") {
    const marking = configureSurfaceMarking(
      createNationalMarking("us", tier === "ultra" ? 0.28 : 0.235),
    );
    marking.name = `a6-wing-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
    const bevelRise = tier === "ultra" ? 0.035 * 0.72 : 0;
    marking.position.set(side * 2.78, 0.22 + thickness * 0.5 + bevelRise + 0.012, 0.12);
    parent.add(marking);
    markings.push(marking);
    const foldLine = addPanelLine(parent, [side * 2.76, 0.22 + thickness * 0.57, 0.2], [0.025, 0.015, 0.82], [0, 0.18 * side, 0]);
    foldLine.name = `a6-wing-fold-hinge:${side < 0 ? "port" : "starboard"}:${tier}`;
    const speedBrake = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, thickness * 0.94, 0.62),
      aircraftPanelMaterial,
    );
    speedBrake.name = `a6-closed-wingtip-speed-brake:${side < 0 ? "port" : "starboard"}:${tier}`;
    speedBrake.position.set(side * (halfSpan - 0.045), 0.22, 0.16);
    parent.add(speedBrake);
  }
  if (tier === "ultra") {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.17, 0.86), aircraftPanelMaterial);
    fence.position.set(side * 2.34, 0.34, -0.18);
    fence.rotation.y = side * 0.14;
    parent.add(fence);
    addPanelLine(parent, [side * 1.7, 0.3, 0.67], [0.92, 0.012, 0.026], [0, side * 0.11, 0]);
    addPanelLine(parent, [side * 3.34, 0.3, 0.27], [0.54, 0.012, 0.024], [0, side * 0.12, 0]);
  }
}

function addTail(parent: THREE.Group, tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.12 : tier === "high" ? 0.09 : 0.065;
  const fin = createVerticalSurface([
    [-1.02, 0],
    [-0.16, 1.27],
    [0.52, 1.12],
    [0.82, 0],
  ], thickness, fuselagePaint);
  fin.position.set(0, 0.37, 3.05);
  parent.add(fin);
  for (const side of [-1, 1]) {
    const tailplane = createPlanform([
      [side * 0.35, 2.5],
      [side * 1.74, 3.08],
      [side * 1.55, 3.78],
      [side * 0.38, 3.57],
    ], undersidePaint, thickness * 0.72);
    tailplane.position.y = 0.03;
    parent.add(tailplane);
  }
  if (tier !== "low") {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.4, tier === "ultra" ? 10 : 6), aircraftPanelMaterial);
    hook.rotation.x = Math.PI / 2;
    hook.position.set(0, -0.51, 3.25);
    parent.add(hook);
  }
}

function addStaticAirframe(parent: THREE.Group, tier: DetailTier, markings: THREE.Object3D[]) {
  const segments = tier === "ultra" ? 30 : tier === "high" ? 18 : 10;
  const radome = createLoftedFuselage(radomeStations(), radomePaint, segments);
  radome.name = `a6-blunt-radome:${tier}`;
  parent.add(radome);
  const fuselage = createLoftedFuselage(fuselageStations(), fuselagePaint, segments);
  fuselage.name = `a6-wide-fuselage:${tier}`;
  parent.add(fuselage);
  addCanopy(parent, tier);
  addTramTurret(parent, tier);
  for (const side of [-1, 1]) {
    addShoulderFairing(parent, side, tier);
    addShoulderIntake(parent, side, tier);
    addWing(parent, side, tier, markings);
    const nozzle = createNozzle(0.31, 0.58, tier === "ultra" ? 14 : 10, tier === "ultra");
    nozzle.position.set(side * 0.68, -0.08, 3.22);
    nozzle.rotation.x = THREE.MathUtils.degToRad(-7);
    parent.add(nozzle);
  }
  addTail(parent, tier);

  if (tier !== "low") {
    addPanelLine(parent, [-0.34, -0.56, 0.35], [0.29, 0.018, 1.08]);
    addPanelLine(parent, [0.34, -0.56, 0.35], [0.29, 0.018, 1.08]);
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.72, tier === "ultra" ? 9 : 6), aircraftPanelMaterial);
    probe.rotation.x = Math.PI * 0.43;
    probe.rotation.z = -0.08;
    probe.position.set(0.18, 0.55, -3.65);
    parent.add(probe);
  }
  if (tier === "ultra") {
    const antiGlare = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.018, 0.8), aircraftPanelMaterial);
    antiGlare.position.set(0, 0.48, -3.24);
    antiGlare.rotation.x = -0.12;
    parent.add(antiGlare);
    const dorsalAntenna = createVerticalSurface([
      [-0.18, 0],
      [0, 0.2],
      [0.18, 0],
    ], 0.025, aircraftPanelMaterial);
    dorsalAntenna.position.set(0, 0.57, 1.35);
    parent.add(dorsalAntenna);
  }
}

function wingUndersideY(tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.13 : tier === "high" ? 0.095 : 0.065;
  const bevelRise = tier === "ultra" ? 0.035 * 0.72 : 0;
  return 0.22 - thickness * 0.5 - bevelRise;
}

function addPylonVisual(parent: THREE.Group, station: A6EPylonStation, tier: DetailTier) {
  const { position } = station;
  const centerline = station.attachment === "centerline";
  const railBottomY = position[1] + station.railContactOffsetY;
  const pylonOriginY = centerline
    ? position[1]
    : railBottomY - TAPERED_PYLON_RAIL_BOTTOM_Y;
  const pylonHeight = centerline
    ? 0.24
    : Math.max(0.32, wingUndersideY(tier) - pylonOriginY);
  const pylon = createTaperedPylon(
    undersidePaint,
    aircraftPanelMaterial,
    pylonHeight,
    centerline ? 0.58 : 0.52,
    tier === "low" ? 0.1 : tier === "high" ? 0.12 : 0.14,
    centerline ? 0.78 : 0.98,
  );
  pylon.name = `a6-visual-pylon:${station.id}:${tier}`;
  pylon.position.set(position[0], pylonOriginY, position[2]);
  pylon.userData.stationId = station.id;
  pylon.userData.railBottomY = railBottomY;
  pylon.userData.airframeContactY = centerline ? pylonOriginY + pylonHeight : wingUndersideY(tier);
  parent.add(pylon);
}

export function createA6Model() {
  const root = new THREE.Group();
  root.name = "A-6E Intruder visual rig";
  const tiers = createAircraftTiers(root);
  const surfaceMarkings: THREE.Object3D[] = [];
  addStaticAirframe(tiers.ultra, "ultra", surfaceMarkings);
  addStaticAirframe(tiers.high, "high", surfaceMarkings);
  addStaticAirframe(tiers.low, "low", surfaceMarkings);
  root.userData.surfaceMarkings = surfaceMarkings;

  for (const side of [-1, 1]) addNavigationLight(root, root, side, [side * (halfSpan - 0.035), 0.28, 0.14], 0.06);

  // Every LOD renders all five physical pylons. Only the two outer stations
  // currently expose gameplay weapon anchors.
  for (const tier of ["ultra", "high", "low"] as const) {
    const parent = tiers[tier];
    for (const station of A6E_PYLON_STATIONS) addPylonVisual(parent, station, tier);
  }

  for (const station of A6E_STRIKE_STATIONS) {
    const mount = addAirWeaponMount(root, root, station.id, station.position, {
      ultraParent: tiers.ultra,
      highParent: tiers.high,
      ultraPieces: [],
      highPieces: [],
    });
    mount.userData.weaponUpperContactY = station.railContactOffsetY;
    mount.userData.weaponContactOverlap = 0.008;
    mount.userData.weaponRoll = Math.PI * 0.25;
  }
  root.userData.visualPylonCount = A6E_PYLON_STATIONS.length;
  root.userData.visualPylonPositions = A6E_PYLON_STATIONS.map((station) => station.position);

  tiers.ultra.visible = true;
  tiers.high.visible = false;
  tiers.low.visible = false;
  const finished = finishAircraftModel(root, tiers, {
    length,
    realLengthMeters: dimensions.realLengthMeters,
    realWingspanMeters: dimensions.realWingspanMeters,
    engines: [
      new THREE.Vector3(-0.68, -0.08, 3.43),
      new THREE.Vector3(0.68, -0.08, 3.43),
    ],
    detailTags: [
      "side-by-side-canopy",
      "blunt-radome",
      "tram-turret",
      "d-shaped-shoulder-intakes",
      "folding-swept-wings",
      "closed-wingtip-speed-brakes",
      "five-external-pylons",
      "single-fin",
      "arresting-hook",
    ],
    lodNear: 84,
    lodMedium: 240,
  });
  finished.userData.modelAssetVersion = "v1.1-ultra";
  finished.userData.referenceDimensions = dimensions;
  return finished;
}
