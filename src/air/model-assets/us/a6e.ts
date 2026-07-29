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
const exhaustPaint = aircraftPaint(0x596260, 0.43, 0.16);
const cockpitSeatPaint = aircraftPaint(0x35474a, 0.66, 0.04);
const cockpitHeadrestPaint = aircraftPaint(0x4c5955, 0.72, 0.03);

const A6_RADOME_ULTRA: readonly FuselageStation[] = [
  { z: -halfLength, radiusX: 0.028, radiusY: 0.024, centerY: -0.17 },
  { z: -halfLength + 0.075, radiusX: 0.15, radiusY: 0.11, centerY: -0.165 },
  { z: -3.98, radiusX: 0.31, radiusY: 0.23, centerY: -0.135 },
  { z: -3.8, radiusX: 0.5, radiusY: 0.37, centerY: -0.075 },
  { z: -3.6, radiusX: 0.66, radiusY: 0.48, centerY: -0.005 },
  { z: -3.39, radiusX: 0.75, radiusY: 0.54, centerY: 0.045 },
  { z: -3.2, radiusX: 0.79, radiusY: 0.56, centerY: 0.07 },
];

const A6_FUSELAGE_ULTRA: readonly FuselageStation[] = [
  { z: -3.2, radiusX: 0.79, radiusY: 0.56, centerY: 0.07 },
  { z: -2.86, radiusX: 0.87, radiusY: 0.61, centerY: 0.105 },
  { z: -2.42, radiusX: 0.9, radiusY: 0.62, centerY: 0.115 },
  { z: -1.86, radiusX: 0.88, radiusY: 0.59, centerY: 0.1 },
  { z: -1.22, radiusX: 0.83, radiusY: 0.55, centerY: 0.085 },
  { z: -0.48, radiusX: 0.76, radiusY: 0.49, centerY: 0.075 },
  { z: 0.34, radiusX: 0.7, radiusY: 0.44, centerY: 0.085 },
  { z: 1.08, radiusX: 0.64, radiusY: 0.39, centerY: 0.1 },
  { z: 1.82, radiusX: 0.56, radiusY: 0.34, centerY: 0.12 },
  { z: 2.48, radiusX: 0.45, radiusY: 0.28, centerY: 0.155 },
  { z: 3.08, radiusX: 0.32, radiusY: 0.21, centerY: 0.18 },
  { z: 3.7, radiusX: 0.17, radiusY: 0.115, centerY: 0.18 },
  { z: halfLength, radiusX: 0.02, radiusY: 0.02, centerY: 0.16 },
];

function tierStations(
  source: readonly FuselageStation[],
  tier: DetailTier,
  highIndices: readonly number[],
  lowIndices: readonly number[],
) {
  if (tier === "ultra") return source;
  return (tier === "high" ? highIndices : lowIndices).map((index) => source[index]);
}

function radomeStations(tier: DetailTier) {
  return tierStations(A6_RADOME_ULTRA, tier, [0, 1, 3, 5, 6], [0, 2, 4, 6]);
}

function fuselageStations(tier: DetailTier) {
  return tierStations(
    A6_FUSELAGE_ULTRA,
    tier,
    [0, 2, 4, 6, 8, 10, 11, 12],
    [0, 3, 6, 9, 11, 12],
  );
}

function traceDProfile(
  path: THREE.Shape | THREE.Path,
  width: number,
  height: number,
  segments: number,
) {
  path.moveTo(-width * 0.48, -height * 0.5);
  path.lineTo(width * 0.08, -height * 0.5);
  for (let index = 0; index <= segments; index++) {
    const angle = -Math.PI * 0.5 + index / segments * Math.PI;
    path.lineTo(width * 0.08 + Math.cos(angle) * width * 0.42, Math.sin(angle) * height * 0.5);
  }
  path.lineTo(-width * 0.48, height * 0.5);
  path.closePath();
}

function createDShape(
  width: number,
  height: number,
  depth: number,
  segments: number,
  wall = 0,
) {
  const shape = new THREE.Shape();
  traceDProfile(shape, width, height, segments);
  if (wall > 0) {
    const hole = new THREE.Path();
    traceDProfile(hole, width - wall * 2, height - wall * 2, Math.max(6, segments - 2));
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: wall > 0,
    bevelSegments: wall > 0 ? 2 : 0,
    bevelSize: wall > 0 ? Math.min(0.012, wall * 0.2) : 0,
    bevelThickness: wall > 0 ? Math.min(0.01, depth * 0.08) : 0,
    bevelOffset: wall > 0 ? -Math.min(0.012, wall * 0.2) : 0,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

function addShoulderIntake(parent: THREE.Group, side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `a6-d-shoulder-intake:${side < 0 ? "port" : "starboard"}:${tier}`;
  group.position.set(side * 0.82, 0.04, -2.08);
  group.scale.x = side;
  const width = tier === "ultra" ? 0.49 : tier === "high" ? 0.45 : 0.4;
  const height = tier === "ultra" ? 0.4 : tier === "high" ? 0.36 : 0.32;
  const depth = tier === "ultra" ? 0.3 : tier === "high" ? 0.23 : 0.16;
  const segments = tier === "ultra" ? 28 : tier === "high" ? 16 : 8;
  const wall = tier === "ultra" ? 0.058 : tier === "high" ? 0.052 : 0.047;
  const lip = new THREE.Mesh(createDShape(width, height, depth, segments, wall), intakePaint);
  group.add(lip);
  const throat = new THREE.Mesh(
    createDShape(width - wall * 2.4, height - wall * 2.4, 0.025, Math.max(7, segments - 4)),
    aircraftDarkMaterial,
  );
  // Forward is -Z. The dark face therefore sits aft of the lip, inside the duct.
  throat.position.z = depth * 0.58;
  group.add(throat);
  if (tier !== "low") {
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, height * 0.9, depth * 1.45),
      undersidePaint,
    );
    splitter.position.set(-width * 0.45, 0, depth * 0.08);
    group.add(splitter);
    const upperRamp = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.54, 0.018, depth * 0.66),
      aircraftPanelMaterial,
    );
    upperRamp.position.set(width * 0.05, height * 0.27, depth * 0.1);
    upperRamp.rotation.x = -0.09;
    group.add(upperRamp);
  }
  parent.add(group);
}

function addShoulderFairing(parent: THREE.Group, side: number, tier: DetailTier) {
  const segments = tier === "ultra" ? 40 : tier === "high" ? 26 : 12;
  const ultraStations: readonly FuselageStation[] = [
    { z: -2.25, radiusX: 0.17, radiusY: 0.19, centerY: 0.03 },
    { z: -2.06, radiusX: 0.27, radiusY: 0.27, centerY: 0.01 },
    { z: -1.66, radiusX: 0.34, radiusY: 0.32, centerY: -0.02 },
    { z: -0.82, radiusX: 0.36, radiusY: 0.33, centerY: -0.04 },
    { z: 0, radiusX: 0.35, radiusY: 0.32, centerY: -0.05 },
    { z: 0.78, radiusX: 0.33, radiusY: 0.3, centerY: -0.05 },
    { z: 1.42, radiusX: 0.29, radiusY: 0.27, centerY: -0.04 },
    { z: 1.92, radiusX: 0.24, radiusY: 0.23, centerY: -0.02 },
    { z: 2.28, radiusX: 0.16, radiusY: 0.17, centerY: 0.015 },
    { z: 2.5, radiusX: 0.08, radiusY: 0.09, centerY: 0.045 },
  ];
  const stations = tierStations(ultraStations, tier, [0, 1, 3, 5, 7, 9], [0, 2, 5, 8, 9]);
  const fairing = createLoftedFuselage(stations, intakePaint, segments);
  fairing.name = `a6-engine-shoulder-fairing:${side < 0 ? "port" : "starboard"}:${tier}`;
  fairing.position.x = side * 0.76;
  parent.add(fairing);
}

function addCanopy(parent: THREE.Group, tier: DetailTier) {
  const ultraStations: readonly FuselageStation[] = [
    { z: -3.22, radiusX: 0.07, radiusY: 0.035, centerY: 0.47 },
    { z: -3.08, radiusX: 0.34, radiusY: 0.15, centerY: 0.58 },
    { z: -2.84, radiusX: 0.55, radiusY: 0.27, centerY: 0.66 },
    { z: -2.5, radiusX: 0.62, radiusY: 0.31, centerY: 0.67 },
    { z: -2.17, radiusX: 0.56, radiusY: 0.26, centerY: 0.64 },
    { z: -1.91, radiusX: 0.31, radiusY: 0.13, centerY: 0.54 },
    { z: -1.76, radiusX: 0.06, radiusY: 0.03, centerY: 0.45 },
  ];
  const stations = tierStations(ultraStations, tier, [0, 1, 3, 5, 6], [0, 2, 4, 6]);
  const canopy = createLoftedFuselage(
    stations,
    aircraftGlassMaterial,
    tier === "ultra" ? 48 : tier === "high" ? 30 : 14,
  );
  canopy.name = `a6-side-by-side-canopy:${tier}`;
  parent.add(canopy);
  if (tier === "low") return;

  const coaming = createPlanform([
    [-0.35, -3.04],
    [-0.52, -2.7],
    [-0.5, -2.05],
    [0.5, -2.05],
    [0.52, -2.7],
    [0.35, -3.04],
  ], aircraftDarkMaterial, 0.075);
  coaming.name = `a6-cockpit-coaming:${tier}`;
  coaming.position.y = 0.52;
  parent.add(coaming);

  const centerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.08), aircraftPanelMaterial);
  centerFrame.position.set(0, 0.94, -2.52);
  parent.add(centerFrame);
  for (const [z, width, y, pitch] of [
    [-3.05, 0.7, 0.73, -0.18],
    [-2.78, 1.03, 0.91, -0.04],
    [-2.17, 1.0, 0.86, 0.08],
  ] as const) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.04), aircraftPanelMaterial);
    bow.position.set(0, y, z);
    bow.rotation.x = pitch;
    parent.add(bow);
  }
  if (tier === "ultra") {
    for (const x of [-0.27, 0.27]) {
      const seat = new THREE.Group();
      seat.name = `a6-cockpit-seat:${x < 0 ? "port" : "starboard"}`;
      seat.position.set(x, 0.56, -2.46);
      const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.31), cockpitSeatPaint);
      bucket.rotation.x = -0.08;
      seat.add(bucket);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.34, 0.1), cockpitSeatPaint);
      back.position.set(0, 0.13, 0.11);
      back.rotation.x = -0.16;
      seat.add(back);
      parent.add(seat);
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.1), cockpitHeadrestPaint);
      headrest.name = `a6-cockpit-headrest:${x < 0 ? "port" : "starboard"}`;
      headrest.position.set(x, 0.78, -2.37);
      parent.add(headrest);
      const instrumentHood = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.2), aircraftDarkMaterial);
      instrumentHood.position.set(x, 0.63, -2.82);
      instrumentHood.rotation.x = -0.12;
      parent.add(instrumentHood);
    }
  }
}

function addTramTurret(parent: THREE.Group, tier: DetailTier) {
  const turret = new THREE.Group();
  turret.name = `a6e-tram-turret:${tier}`;
  turret.position.set(0, -0.585, -3.03);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.145, 0.085, tier === "ultra" ? 36 : tier === "high" ? 24 : 12),
    undersidePaint,
  );
  collar.name = `a6e-tram-collar:${tier}`;
  collar.position.y = 0.055;
  turret.add(collar);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.125,
      tier === "ultra" ? 44 : tier === "high" ? 32 : 14,
      tier === "ultra" ? 26 : tier === "high" ? 18 : 9,
    ),
    tramPaint,
  );
  shell.name = `a6e-tram-shell:${tier}`;
  shell.scale.set(1, 0.78, 0.9);
  turret.add(shell);
  if (tier !== "low") {
    const window = new THREE.Mesh(
      new THREE.CircleGeometry(0.063, tier === "ultra" ? 28 : 16),
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

function wingPoints(side: number, tier: DetailTier) {
  if (tier === "ultra") {
    return [
      [side * 0.52, -1.46],
      [side * 2.66, -0.73],
      [side * (halfSpan - 0.11), -0.24],
      [side * (halfSpan - 0.035), -0.08],
      [side * (halfSpan - 0.035), 0.38],
      [side * (halfSpan - 0.11), 0.54],
      [side * 2.72, 0.45],
      [side * 0.54, 0.9],
    ] as const;
  }
  if (tier === "high") {
    return [
      [side * 0.52, -1.45],
      [side * 2.66, -0.72],
      [side * (halfSpan - 0.04), -0.08],
      [side * (halfSpan - 0.04), 0.38],
      [side * 2.72, 0.45],
      [side * 0.54, 0.9],
    ] as const;
  }
  return [
    [side * 0.54, -1.43],
    [side * (halfSpan - 0.045), -0.08],
    [side * (halfSpan - 0.045), 0.38],
    [side * 0.56, 0.88],
  ] as const;
}

function addWing(parent: THREE.Group, side: number, tier: DetailTier, markings: THREE.Object3D[]) {
  const thickness = tier === "ultra" ? 0.14 : tier === "high" ? 0.1 : 0.07;
  const wing = tier === "ultra"
    ? createBeveledPlanform(wingPoints(side, tier), fuselagePaint, thickness, 0.035, 3)
    : createPlanform(wingPoints(side, tier), tier === "low" ? undersidePaint : fuselagePaint, thickness);
  wing.name = `a6-folding-wing:${side < 0 ? "port" : "starboard"}:${tier}`;
  wing.position.y = 0.22;
  parent.add(wing);

  // U.S. national insignia convention uses one upper-wing marking; the
  // opposite-side insignia is carried on the lower surface.
  if (tier !== "low" && side < 0) {
    const marking = configureSurfaceMarking(
      createNationalMarking("us", tier === "ultra" ? 0.28 : 0.235),
    );
    marking.name = `a6-wing-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
    const bevelRise = tier === "ultra" ? 0.035 * 0.72 : 0;
    marking.position.set(side * 2.78, 0.22 + thickness * 0.5 + bevelRise + 0.012, 0.12);
    parent.add(marking);
    markings.push(marking);
  }
  if (tier !== "low") {
    const foldLine = addPanelLine(parent, [side * 2.76, 0.22 + thickness * 0.57, 0.2], [0.025, 0.015, 0.82], [0, 0.18 * side, 0]);
    foldLine.name = `a6-wing-fold-hinge:${side < 0 ? "port" : "starboard"}:${tier}`;
    const speedBrake = addPanelLine(
      parent,
      [side * (halfSpan - 0.085), 0.22 + thickness * 0.56, 0.17],
      [0.028, 0.014, 0.52],
    );
    speedBrake.name = `a6-closed-wingtip-speed-brake:${side < 0 ? "port" : "starboard"}:${tier}`;
  }
  if (tier === "ultra") {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.13, 0.74), aircraftPanelMaterial);
    fence.position.set(side * 2.34, 0.34, -0.16);
    fence.rotation.y = side * 0.14;
    parent.add(fence);
    addPanelLine(parent, [side * 1.7, 0.3, 0.67], [0.92, 0.012, 0.026], [0, side * 0.11, 0]);
    addPanelLine(parent, [side * 3.34, 0.3, 0.27], [0.54, 0.012, 0.024], [0, side * 0.12, 0]);
    addPanelLine(parent, [side * 2.16, 0.3, -0.68], [1.02, 0.012, 0.022], [0, side * 0.34, 0]);
  }
}

function addWingRootFillet(parent: THREE.Group, side: number, tier: DetailTier) {
  if (tier === "low") return;
  const points = [
    [side * 0.43, -1.5],
    [side * 1.13, -1.18],
    [side * 1.18, 0.7],
    [side * 0.47, 1.04],
  ] as const;
  const fillet = tier === "ultra"
    ? createBeveledPlanform(points, fuselagePaint, 0.12, 0.028, 2)
    : createPlanform(points, fuselagePaint, 0.085);
  fillet.name = `a6-wing-root-fillet:${side < 0 ? "port" : "starboard"}:${tier}`;
  fillet.position.y = 0.2;
  parent.add(fillet);
}

function addFuselageMarking(
  parent: THREE.Group,
  side: number,
  tier: Exclude<DetailTier, "low">,
  markings: THREE.Object3D[],
) {
  const marking = configureSurfaceMarking(
    createNationalMarking("us", tier === "ultra" ? 0.18 : 0.155),
  );
  marking.name = `a6-fuselage-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
  const xAxis = new THREE.Vector3(0, 0, side);
  const yAxis = new THREE.Vector3(side, 0, 0);
  const zAxis = new THREE.Vector3(0, 1, 0);
  marking.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  // The aft engine-shoulder fairing is the visible side skin at this station;
  // x=0.59 sits inside that loft and lets the fairing occlude the insignia.
  // Keep the decal just outside the measured fairing crown instead.
  marking.position.set(side * 1.045, -0.025, 1.56);
  parent.add(marking);
  markings.push(marking);
}

function addJetpipe(parent: THREE.Group, side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `a6-j52-exhaust:${side < 0 ? "port" : "starboard"}:${tier}`;
  group.position.set(side * 0.76, -0.105, 2.23);
  const segments = tier === "ultra" ? 36 : tier === "high" ? 24 : 12;
  const radialSegments = tier === "ultra" ? 10 : tier === "high" ? 7 : 5;
  const radius = tier === "low" ? 0.175 : 0.2;
  const depth = tier === "ultra" ? 0.34 : tier === "high" ? 0.3 : 0.24;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, depth, segments, 1, true),
    exhaustPaint,
  );
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.78, segments),
    aircraftDarkMaterial,
  );
  throat.position.z = depth * 0.515;
  group.add(throat);
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.9, tier === "low" ? 0.017 : 0.022, radialSegments, segments),
    aircraftPanelMaterial,
  );
  lip.position.z = depth * 0.525;
  group.add(lip);
  parent.add(group);
}

function addTail(parent: THREE.Group, tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.13 : tier === "high" ? 0.095 : 0.065;
  const fin = createVerticalSurface([
    [-1.08, 0],
    [-0.22, 1.45],
    [0.56, 1.34],
    [0.82, 0],
  ], thickness, fuselagePaint);
  fin.name = `a6-single-fin:${tier}`;
  fin.position.set(0, 0.33, 3.02);
  parent.add(fin);
  for (const side of [-1, 1]) {
    const points = [
      [side * 0.35, 2.5],
      [side * 1.55, 3.05],
      [side * 1.45, 3.72],
      [side * 0.38, 3.57],
    ] as const;
    const tailplane = tier === "ultra"
      ? createBeveledPlanform(points, undersidePaint, thickness * 0.72, 0.022, 2)
      : createPlanform(points, undersidePaint, thickness * 0.72);
    tailplane.name = `a6-horizontal-tail:${side < 0 ? "port" : "starboard"}:${tier}`;
    tailplane.position.y = 0.03;
    parent.add(tailplane);
  }
  if (tier !== "low") {
    const hookAssembly = new THREE.Group();
    hookAssembly.name = `a6-stowed-arresting-hook:${tier}`;
    hookAssembly.position.set(0, -0.29, 2.98);
    const hook = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, 1.34, tier === "ultra" ? 10 : 6),
      aircraftPanelMaterial,
    );
    hook.rotation.x = Math.PI / 2;
    hook.rotation.z = -0.025;
    hookAssembly.add(hook);
    const hinge = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, tier === "ultra" ? 12 : 8, tier === "ultra" ? 8 : 5),
      exhaustPaint,
    );
    hinge.position.set(0, 0.015, -0.67);
    hookAssembly.add(hinge);
    parent.add(hookAssembly);
  }
  if (tier !== "low") {
    const tailLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, tier === "ultra" ? 12 : 8, tier === "ultra" ? 8 : 6),
      new THREE.MeshBasicMaterial({ color: 0xe9f2e8 }),
    );
    tailLight.name = `a6-tail-position-light:${tier}`;
    tailLight.position.set(0, 1.52, 3.62);
    parent.add(tailLight);
  }
}

function addStaticAirframe(parent: THREE.Group, tier: DetailTier, markings: THREE.Object3D[]) {
  const segments = tier === "ultra" ? 52 : tier === "high" ? 32 : 14;
  const radome = createLoftedFuselage(radomeStations(tier), radomePaint, segments);
  radome.name = `a6-blunt-radome:${tier}`;
  parent.add(radome);
  const fuselage = createLoftedFuselage(fuselageStations(tier), fuselagePaint, segments);
  fuselage.name = `a6-wide-fuselage:${tier}`;
  parent.add(fuselage);
  addCanopy(parent, tier);
  addTramTurret(parent, tier);
  for (const side of [-1, 1]) {
    addShoulderFairing(parent, side, tier);
    addShoulderIntake(parent, side, tier);
    addWingRootFillet(parent, side, tier);
    addWing(parent, side, tier, markings);
    addJetpipe(parent, side, tier);
  }
  addTail(parent, tier);
  if (tier !== "low") {
    addFuselageMarking(parent, -1, tier, markings);
    addFuselageMarking(parent, 1, tier, markings);
  }

  if (tier !== "low") {
    addPanelLine(parent, [-0.34, -0.37, 0.35], [0.29, 0.018, 1.08]);
    addPanelLine(parent, [0.34, -0.37, 0.35], [0.29, 0.018, 1.08]);
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.72, tier === "ultra" ? 9 : 6), aircraftPanelMaterial);
    probe.rotation.x = Math.PI * 0.43;
    probe.rotation.z = -0.08;
    probe.position.set(0.34, 0.62, -3.57);
    parent.add(probe);
  }
  if (tier === "ultra") {
    const antiGlare = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.018, 0.8), aircraftPanelMaterial);
    antiGlare.position.set(0, 0.63, -3.24);
    antiGlare.rotation.x = -0.12;
    parent.add(antiGlare);
    const dorsalAntenna = createVerticalSurface([
      [-0.18, 0],
      [0, 0.2],
      [0.18, 0],
    ], 0.025, aircraftPanelMaterial);
    dorsalAntenna.position.set(0, 0.47, 1.35);
    parent.add(dorsalAntenna);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.043, 14, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4a3e }),
    );
    beacon.name = "a6-upper-anti-collision-beacon:ultra";
    beacon.position.set(0, 0.56, 0.72);
    parent.add(beacon);
    for (const side of [-1, 1]) {
      const formationStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.034, 0.54),
        new THREE.MeshBasicMaterial({ color: 0xb8e7a7 }),
      );
      formationStrip.name = `a6-formation-strip:${side < 0 ? "port" : "starboard"}:ultra`;
      formationStrip.position.set(side * 0.66, 0.17, 1.05);
      parent.add(formationStrip);
    }
  }
}

function wingUndersideY(tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.14 : tier === "high" ? 0.1 : 0.07;
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
      new THREE.Vector3(-0.76, -0.105, 2.23),
      new THREE.Vector3(0.76, -0.105, 2.23),
    ],
    detailTags: [
      "side-by-side-canopy",
      "blunt-radome",
      "tram-turret",
      "d-shaped-shoulder-intakes",
      "folding-swept-wings",
      "closed-wingtip-speed-brakes",
      "non-afterburning-j52-jetpipes",
      "upper-port-national-insignia",
      "five-external-pylons",
      "single-fin",
      "arresting-hook",
    ],
    lodNear: 84,
    lodMedium: 240,
  });
  finished.userData.referenceDimensions = dimensions;
  return finished;
}
