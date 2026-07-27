import * as THREE from "three";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dimensions.js";
import {
  F14A_GLOVE_STATIONS,
  F14A_TUNNEL_STATIONS,
  type F14AWeaponStation,
} from "./f14a-stations.js";
import {
  addAirWeaponMount,
  addNavigationLight,
  addPanelLine,
  aircraftDarkMaterial,
  aircraftGlassMaterial,
  aircraftPaint,
  aircraftPanelMaterial,
  createAircraftTierBranch,
  createAircraftTiers,
  createLoftedFuselage,
  createNationalMarking,
  createNozzle,
  createPlanform,
  createVerticalSurface,
  finishAircraftModel,
  type AircraftModelTiers,
  type FuselageStation,
  type Vec3Tuple,
} from "../model-kit.js";
import {
  configureSurfaceMarking,
  createBeveledPlanform,
  createTaperedPylon,
  TAPERED_PYLON_RAIL_BOTTOM_Y,
} from "./geometry.js";

type DetailTier = "ultra" | "high" | "low";

const dimensions = AIRCRAFT_REFERENCE_DIMENSIONS.F14A;
const length = dimensions.modelLength;
const halfLength = length * 0.5;
const WING_SWEEP_MIN_RAD = THREE.MathUtils.degToRad(20);
const WING_SWEEP_MAX_RAD = THREE.MathUtils.degToRad(68);

const fuselagePaint = aircraftPaint(0x929c9d, 0.5, 0.14);
const undersidePaint = aircraftPaint(0xb0b6b5, 0.55, 0.11);
const radomePaint = aircraftPaint(0x747f80, 0.58, 0.09);
const titaniumPaint = aircraftPaint(0x6d7473, 0.39, 0.17);
const intakePaint = aircraftPaint(0x7e8989, 0.52, 0.12);
const warningPaint = new THREE.MeshStandardMaterial({ color: 0xc63b30, roughness: 0.62 });
const cockpitSeatPaint = aircraftPaint(0x35474a, 0.66, 0.04);
const cockpitHeadrestPaint = aircraftPaint(0x4c5955, 0.72, 0.03);

function fuselageStations(): readonly FuselageStation[] {
  return [
    { z: -halfLength, radiusX: 0.015, radiusY: 0.015, centerY: -0.04 },
    { z: -halfLength + 0.34, radiusX: 0.2, radiusY: 0.18, centerY: -0.035 },
    { z: -halfLength + 0.9, radiusX: 0.37, radiusY: 0.31, centerY: 0 },
    { z: -3.25, radiusX: 0.5, radiusY: 0.43, centerY: 0.05 },
    { z: -2.45, radiusX: 0.58, radiusY: 0.5, centerY: 0.08 },
    { z: -1.55, radiusX: 0.66, radiusY: 0.5, centerY: 0.045 },
    { z: -0.55, radiusX: 0.78, radiusY: 0.43, centerY: 0 },
    { z: 0.45, radiusX: 0.83, radiusY: 0.39, centerY: -0.03 },
    { z: 1.55, radiusX: 0.69, radiusY: 0.34, centerY: -0.04 },
    { z: 2.55, radiusX: 0.54, radiusY: 0.3, centerY: -0.02 },
    { z: 3.45, radiusX: 0.4, radiusY: 0.24, centerY: 0 },
    { z: halfLength, radiusX: 0.018, radiusY: 0.018, centerY: 0 },
  ];
}

function nacelleStations(side: number): readonly FuselageStation[] {
  void side;
  return [
    { z: -1.72, radiusX: 0.43, radiusY: 0.32, centerY: -0.17 },
    { z: -1.18, radiusX: 0.52, radiusY: 0.39, centerY: -0.18 },
    { z: -0.2, radiusX: 0.57, radiusY: 0.42, centerY: -0.17 },
    { z: 1.35, radiusX: 0.56, radiusY: 0.41, centerY: -0.16 },
    { z: 2.65, radiusX: 0.5, radiusY: 0.38, centerY: -0.14 },
    { z: 3.62, radiusX: 0.43, radiusY: 0.35, centerY: -0.12 },
    { z: 4.15, radiusX: 0.39, radiusY: 0.32, centerY: -0.1 },
  ];
}

function addIntake(parent: THREE.Group, side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `f14-intake:${side < 0 ? "port" : "starboard"}:${tier}`;
  group.position.set(side * 1.03, -0.2, -1.42);
  const width = tier === "low" ? 0.72 : 0.84;
  const height = tier === "low" ? 0.42 : 0.54;
  const depth = tier === "ultra" ? 0.82 : 0.6;
  const lip = tier === "ultra" ? 0.075 : 0.105;
  const throat = new THREE.Mesh(
    new THREE.BoxGeometry(width - lip * 2, height - lip * 2, 0.1),
    aircraftDarkMaterial,
  );
  throat.name = `f14-intake-throat:${side < 0 ? "port" : "starboard"}:${tier}`;
  // Aircraft forward is -Z. The dark compressor throat therefore belongs at
  // the aft end of the duct (+Z), behind the intake lip rather than ahead of
  // it where the old sign placed a black plate in free air.
  throat.position.z = depth * 0.5 + 0.012;
  group.add(throat);
  for (const y of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, lip, depth), intakePaint);
    bar.position.y = y * (height - lip) * 0.5;
    group.add(bar);
  }
  for (const x of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(lip, height - lip * 2, depth), intakePaint);
    bar.position.x = x * (width - lip) * 0.5;
    group.add(bar);
  }
  if (tier !== "low") {
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.045, height * 0.88, depth * 0.95), undersidePaint);
    splitter.position.x = -side * width * 0.34;
    group.add(splitter);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.035, depth * 0.72), aircraftPanelMaterial);
    ramp.position.set(side * 0.015, height * 0.13, -0.02);
    ramp.rotation.x = 0.08;
    group.add(ramp);
  }
  parent.add(group);
}

function addCanopy(parent: THREE.Group, tier: DetailTier) {
  const canopy = createLoftedFuselage([
    { z: -3.27, radiusX: 0.07, radiusY: 0.035, centerY: 0.39 },
    { z: -3.02, radiusX: 0.28, radiusY: 0.17, centerY: 0.49 },
    { z: -2.63, radiusX: 0.37, radiusY: 0.25, centerY: 0.51 },
    { z: -2.18, radiusX: 0.35, radiusY: 0.23, centerY: 0.49 },
    { z: -1.82, radiusX: 0.08, radiusY: 0.035, centerY: 0.4 },
  ], aircraftGlassMaterial, tier === "ultra" ? 28 : tier === "high" ? 18 : 10);
  canopy.name = `f14-tandem-canopy:${tier}`;
  parent.add(canopy);
  if (tier === "low") return;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 1.3), aircraftPanelMaterial);
  frame.position.set(0, 0.7, -2.5);
  parent.add(frame);
  for (const [z, width, y] of [[-3.02, 0.58, 0.63], [-2.5, 0.74, 0.71], [-1.98, 0.5, 0.61]] as const) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, 0.04), aircraftPanelMaterial);
    bow.position.set(0, y, z);
    bow.rotation.z = 0.03;
    parent.add(bow);
  }
  if (tier === "ultra") {
    for (const z of [-2.82, -2.18]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.34), cockpitSeatPaint);
      seat.name = `f14-cockpit-seat:${z < -2.5 ? "front" : "rear"}`;
      seat.position.set(0, 0.38, z);
      parent.add(seat);
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.11), cockpitHeadrestPaint);
      headrest.name = `f14-cockpit-headrest:${z < -2.5 ? "front" : "rear"}`;
      headrest.position.set(0, 0.5, z + 0.06);
      parent.add(headrest);
    }
  }
}

function addTailSurfaces(parent: THREE.Group, tier: DetailTier) {
  const thickness = 0.09;
  for (const side of [-1, 1]) {
    const fin = createVerticalSurface([
      [-0.78, 0],
      [-0.02, 1.34],
      [0.55, 1.25],
      [0.84, 0],
    ], thickness, fuselagePaint);
    fin.name = `f14-tail-fin:${side < 0 ? "port" : "starboard"}:${tier}`;
    fin.position.set(side * 1.05, 0.25, 3.0);
    fin.rotation.z = side * -0.13;
    parent.add(fin);

    if (tier !== "low" && side < 0) {
      const tailPosition = new THREE.Mesh(
        new THREE.SphereGeometry(tier === "ultra" ? 0.05 : 0.038, tier === "ultra" ? 14 : 8, tier === "ultra" ? 8 : 6),
        new THREE.MeshBasicMaterial({ color: 0xe9f2e8 }),
      );
      tailPosition.name = `f14-left-fin-tail-light:${tier}`;
      tailPosition.position.set(-thickness * 0.56, 1.14, 0.46);
      fin.add(tailPosition);
    }

    if (tier === "ultra") {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 14, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4a3e }),
      );
      beacon.name = `f14-vertical-tail-anti-collision:${side < 0 ? "port" : "starboard"}:ultra`;
      // Keep the beacon in fin-local space so the tail's 7.5 degree outward
      // cant carries the lamp with the skin instead of leaving it suspended.
      beacon.position.set(side * thickness * 0.56, 1.3, 0.04);
      fin.add(beacon);
    }
    const stabilator = createPlanform([
      [side * 0.56, 2.72],
      [side * 2.34, 3.15],
      [side * 2.06, 3.94],
      [side * 0.62, 3.72],
    ], undersidePaint, thickness * 0.72);
    stabilator.position.y = -0.02;
    parent.add(stabilator);
    const ventral = createVerticalSurface([
      [-0.44, 0],
      [-0.08, 0.48],
      [0.38, 0.35],
      [0.45, 0],
    ], tier === "low" ? 0.04 : thickness * 0.65, undersidePaint);
    ventral.position.set(side * 0.93, -0.36, 3.16);
    ventral.scale.y = -1;
    parent.add(ventral);
  }
}

function addNozzleDetail(parent: THREE.Group, side: number, tier: DetailTier) {
  // The Tomcat's afterbody has a visibly articulated turkey-feather nozzle.
  // Concentric toroidal rings keep that shape readable in the Ultra/High
  // gallery without changing the aircraft's dimensional envelope.
  const radialSegments = tier === "ultra" ? 10 : tier === "high" ? 8 : 6;
  const tubularSegments = tier === "ultra" ? 72 : tier === "high" ? 36 : 18;
  const rings = tier === "low" ? [0.31] : [0.29, 0.36];
  for (const [index, radius] of rings.entries()) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        radius,
        tier === "ultra" ? 0.022 : tier === "high" ? 0.018 : 0.014,
        radialSegments,
        tubularSegments,
      ),
      index === 0 ? aircraftPanelMaterial : titaniumPaint,
    );
    ring.name = `f14-nozzle-ring:${side < 0 ? "port" : "starboard"}:${tier}:${index}`;
    ring.position.set(side * 1.05, -0.1, 4.06);
    parent.add(ring);
  }
}

function addFuselageMarking(
  parent: THREE.Group,
  side: number,
  tier: Exclude<DetailTier, "low">,
  surfaceMarkings: THREE.Object3D[],
) {
  const markingCenterZ = 0.72;
  // At this station the nacelle section is approximately 0.565 units wide
  // from its x=+-1.05 centreline. Anchor the decal just outside that skin;
  // x=+-0.72 sat inside both the lifting body and engine nacelle.
  const outboardSkinX = 1.05 + 0.565;
  const skinOffset = 0.008;
  const marking = configureSurfaceMarking(
    createNationalMarking("us", tier === "ultra" ? 0.18 : 0.155),
  );
  marking.name = `f14-fuselage-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
  const xAxis = new THREE.Vector3(0, 0, side);
  const yAxis = new THREE.Vector3(side, 0, 0);
  const zAxis = new THREE.Vector3(0, 1, 0);
  marking.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  marking.position.set(side * (outboardSkinX + skinOffset), -0.165, markingCenterZ);
  marking.userData.surfaceAnchor = "engine-nacelle-outboard";
  marking.userData.surfaceOffset = skinOffset;
  parent.add(marking);
  surfaceMarkings.push(marking);
}

function addF14Lights(parent: THREE.Group, tier: DetailTier) {
  if (tier === "low") return;
  // Fixed glove position lights remain visible when the variable wings sweep
  // aft; the wingtip lamps are attached to the moving pivots below.
  for (const side of [-1, 1]) {
    for (const y of [0.22, -0.02]) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(tier === "ultra" ? 0.045 : 0.035, tier === "ultra" ? 14 : 8, tier === "ultra" ? 8 : 6),
        new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff473d : 0x54f58a }),
      );
      lamp.name = `f14-glove-position-light:${side < 0 ? "port" : "starboard"}:${y > 0 ? "upper" : "lower"}:${tier}`;
      lamp.position.set(side * 1.92, y, -0.2);
      parent.add(lamp);
    }
  }

  if (tier === "ultra") {
    const lowerBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 14, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4a3e }),
    );
    lowerBeacon.name = "f14-lower-forward-anti-collision:ultra";
    lowerBeacon.position.set(0, -0.5, -3.65);
    parent.add(lowerBeacon);
  }
}

function addStaticAirframe(
  parent: THREE.Group,
  tier: DetailTier,
  surfaceMarkings: THREE.Object3D[],
) {
  const segments = tier === "ultra" ? 72 : tier === "high" ? 40 : 16;
  const fuselage = createLoftedFuselage(fuselageStations().slice(3, -1), fuselagePaint, segments);
  fuselage.name = `f14-forward-fuselage:${tier}`;
  parent.add(fuselage);
  const radome = createLoftedFuselage(fuselageStations().slice(0, 4), radomePaint, segments);
  radome.name = `f14-radome:${tier}`;
  parent.add(radome);

  const centerBodyPoints = [
    [-0.5, -1.62],
    [-1.92, -1.24],
    [-2.26, 0.28],
    [-1.58, 2.28],
    [1.58, 2.28],
    [2.26, 0.28],
    [1.92, -1.24],
    [0.5, -1.62],
  ] as const;
  const centerBody = tier === "ultra"
    ? createBeveledPlanform(centerBodyPoints, undersidePaint, 0.24, 0.05, 3)
    : tier === "high"
      ? createBeveledPlanform(centerBodyPoints, undersidePaint, 0.2, 0.028, 1)
      : createPlanform(centerBodyPoints, undersidePaint, 0.15);
  centerBody.name = `f14-fixed-lifting-body:${tier}`;
  centerBody.position.y = -0.08;
  parent.add(centerBody);

  for (const side of [-1, 1]) {
    const nacelle = createLoftedFuselage(nacelleStations(side), titaniumPaint, segments);
    nacelle.position.x = side * 1.05;
    nacelle.name = `f14-engine-nacelle:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(nacelle);
    if (tier !== "low") addFuselageMarking(parent, side, tier, surfaceMarkings);
    addIntake(parent, side, tier);
    const nozzle = createNozzle(0.4, 0.64, tier === "ultra" ? 16 : 12, tier === "ultra");
    nozzle.position.set(side * 1.05, -0.1, 4.05);
    parent.add(nozzle);
    addNozzleDetail(parent, side, tier);
  }
  addCanopy(parent, tier);
  addTailSurfaces(parent, tier);
  addF14Lights(parent, tier);

  const beaverTailPoints = [
    [-0.72, 2.2],
    [-0.55, 3.55],
    [-0.3, 4.58],
    [0, halfLength - 0.03],
    [0.3, 4.58],
    [0.55, 3.55],
    [0.72, 2.2],
  ] as const;
  const beaverTail = tier === "ultra"
    ? createBeveledPlanform(beaverTailPoints, titaniumPaint, 0.12, 0.035, 2)
    : createPlanform(beaverTailPoints, titaniumPaint, tier === "low" ? 0.07 : 0.1);
  beaverTail.position.y = -0.15;
  parent.add(beaverTail);

  if (tier !== "low") {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.55, tier === "ultra" ? 10 : 6), aircraftPanelMaterial);
    hook.rotation.x = Math.PI / 2;
    hook.rotation.z = 0.08;
    hook.position.set(0, -0.49, 3.58);
    parent.add(hook);
    addPanelLine(parent, [0, -0.515, 0.7], [0.5, 0.018, 1.4]);
    addPanelLine(parent, [0, -0.505, 2.12], [0.42, 0.018, 0.48]);
  }
  if (tier === "ultra") {
    const antiGlare = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.018, 1.05), aircraftPanelMaterial);
    antiGlare.position.set(0, 0.39, -3.32);
    antiGlare.rotation.x = -0.07;
    parent.add(antiGlare);
    for (const side of [-1, 1]) {
      const slime = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.035, 0.72),
        new THREE.MeshBasicMaterial({ color: 0xb8e7a7 }),
      );
      slime.position.set(side * 0.62, 0.25, 1.32);
      parent.add(slime);
    }
  }
}

function addSwingWing(
  root: THREE.Group,
  pivot: THREE.Group,
  side: number,
  branch: AircraftModelTiers,
  surfaceMarkings: THREE.Object3D[],
) {
  const points = [
    [side * 0.48, -0.68],
    // Solve the two measured Tomcat spans (19.55 m clean, 11.65 m swept)
    // around the same pivot: local tip x≈4.012 and pivot x≈0.946 in the
    // 2 m/unit display scale.  Keeping the tip's -0.5 leading-edge station
    // preserves the characteristic aft-kinked planform.
    [side * 4.012, -0.5],
    [side * 4.012, 0],
    [side * 0.48, 0.68],
  ] as const;
  for (const [tier, parent, thickness] of [
    ["ultra", branch.ultra, 0.115],
    ["high", branch.high, 0.085],
    ["low", branch.low, 0.06],
  ] as const) {
    const wing = tier === "ultra"
      ? createBeveledPlanform(points, fuselagePaint, thickness, 0.032, 2)
      : createPlanform(points, tier === "low" ? undersidePaint : fuselagePaint, thickness);
    wing.name = `f14-variable-wing:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(wing);
    if (tier !== "low" && side < 0) {
      const marking = configureSurfaceMarking(
        createNationalMarking("us", tier === "ultra" ? 0.27 : 0.235),
      );
      marking.name = `f14-wing-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
      const bevelRise = tier === "ultra" ? 0.032 * 0.72 : 0;
      marking.position.set(side * 2.18, thickness * 0.5 + bevelRise + 0.012, -0.22);
      parent.add(marking);
      surfaceMarkings.push(marking);
    }
    if (tier !== "low" && side > 0) {
      const lowerMarking = configureSurfaceMarking(
        createNationalMarking("us", tier === "ultra" ? 0.27 : 0.235),
      );
      lowerMarking.name = `f14-wing-lower-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
      lowerMarking.rotation.x = Math.PI;
      const bevelDrop = tier === "ultra" ? 0.032 * 0.72 : 0;
      lowerMarking.position.set(side * 2.18, -thickness * 0.5 - bevelDrop - 0.012, -0.22);
      parent.add(lowerMarking);
      surfaceMarkings.push(lowerMarking);
    }
    if (tier === "ultra") {
      addPanelLine(parent, [side * 1.52, thickness * 0.58, 0.42], [1.38, 0.012, 0.025], [0, 0.16 * side, 0]);
      addPanelLine(parent, [side * 2.68, thickness * 0.58, -0.18], [0.66, 0.012, 0.022], [0, 0.08 * side, 0]);
    }
  }
  addNavigationLight(root, pivot, side, [side * 3.47, 0.02, -0.24], 0.06);
}

function addLowMountHardware(parent: THREE.Group, position: Vec3Tuple, belly = false) {
  const hardware = new THREE.Mesh(
    new THREE.BoxGeometry(belly ? 0.34 : 0.14, belly ? 0.08 : 0.2, belly ? 0.82 : 0.7),
    aircraftPanelMaterial,
  );
  hardware.position.set(position[0], position[1] + (belly ? 0.2 : 0.17), position[2]);
  parent.add(hardware);
}

function addGlovePylonVisual(parent: THREE.Group, station: F14AWeaponStation, tier: DetailTier) {
  const { position } = station;
  const inner = station.id.endsWith("inner");
  const pylon = createTaperedPylon(
    undersidePaint,
    aircraftPanelMaterial,
    inner ? 0.42 : 0.34,
    inner ? 0.58 : 0.46,
    tier === "low" ? 0.08 : tier === "high" ? 0.1 : 0.115,
    inner ? 0.9 : 0.76,
  );
  pylon.name = `f14-fixed-glove-pylon:${position[0] < 0 ? "port" : "starboard"}:${inner ? "inner" : "outer"}:${tier}`;
  pylon.position.set(...position);
  parent.add(pylon);
}

export function createF14Model() {
  const root = new THREE.Group();
  root.name = "F-14A Tomcat visual rig";
  const tiers = createAircraftTiers(root);
  const surfaceMarkings: THREE.Object3D[] = [];
  addStaticAirframe(tiers.ultra, "ultra", surfaceMarkings);
  addStaticAirframe(tiers.high, "high", surfaceMarkings);
  addStaticAirframe(tiers.low, "low", surfaceMarkings);

  const variableWings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = `f14-variable-wing-pivot:${side < 0 ? "port" : "starboard"}`;
    pivot.position.set(side * 0.946, 0.05, -0.12);
    // The runtime/gallery assign index 0 = -sweep and index 1 = +sweep.
    // Store starboard first so both wings rotate aft, matching the real F-14.
    pivot.rotation.y = -side * WING_SWEEP_MIN_RAD;
    pivot.userData.wingSweepSign = -side;
    root.add(pivot);
    variableWings.unshift(pivot);
    const branch = createAircraftTierBranch(root, pivot, `f14-variable-wing:${side < 0 ? "port" : "starboard"}`);
    branch.ultra.visible = true;
    branch.high.visible = false;
    branch.low.visible = false;
    addSwingWing(root, pivot, side, branch, surfaceMarkings);
  }
  root.userData.variableWings = variableWings;
  root.userData.surfaceMarkings = surfaceMarkings;
  root.userData.wingSweepMinDeg = 20;
  root.userData.wingSweepMaxDeg = 68;
  root.userData.wingSweepRangeRad = [WING_SWEEP_MIN_RAD, WING_SWEEP_MAX_RAD];

  // F-14 glove pylons and fuselage pallets are fixed to the airframe. They
  // intentionally do not live under either variable-wing pivot.
  const gloveRig = new THREE.Group();
  gloveRig.name = "f14-fixed-glove-weapon-rig";
  root.add(gloveRig);
  root.userData.fixedGloveWeaponRig = gloveRig;
  for (const station of F14A_GLOVE_STATIONS) {
    addGlovePylonVisual(tiers.ultra, station, "ultra");
    addGlovePylonVisual(tiers.high, station, "high");
    addGlovePylonVisual(tiers.low, station, "low");
    const mount = addAirWeaponMount(root, gloveRig, station.id, station.position, {
      ultraParent: tiers.ultra,
      highParent: tiers.high,
      ultraPieces: [],
      highPieces: [],
    });
    mount.userData.weaponUpperContactY = TAPERED_PYLON_RAIL_BOTTOM_Y;
    mount.userData.weaponContactOverlap = 0.008;
  }

  for (const station of F14A_TUNNEL_STATIONS) {
    const mount = addAirWeaponMount(root, gloveRig, station.id, station.position, {
      ultraParent: tiers.ultra,
      highParent: tiers.high,
      ultraPieces: [
        { offset: [0, 0.18, 0], size: [0.4, 0.09, 1.0] },
        { offset: [0, 0.29, -0.12], size: [0.2, 0.14, 0.42] },
      ],
      highPieces: [
        { offset: [0, 0.2, 0], size: [0.36, 0.12, 0.92] },
      ],
    });
    mount.userData.weaponUpperContactY = 0.135;
    mount.userData.weaponContactOverlap = 0.008;
    addLowMountHardware(tiers.low, station.position, true);
  }
  root.userData.fuselagePalletCount = F14A_TUNNEL_STATIONS.length;
  root.userData.surfaceMarkings = surfaceMarkings;

  const warningTriangles = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.2, 3),
    warningPaint,
  );
  warningTriangles.rotation.x = Math.PI / 2;
  warningTriangles.position.set(0, 0.03, -halfLength + 0.2);
  tiers.ultra.add(warningTriangles);

  tiers.ultra.visible = true;
  tiers.high.visible = false;
  tiers.low.visible = false;
  const finished = finishAircraftModel(root, tiers, {
    length,
    realLengthMeters: dimensions.realLengthMeters,
    realWingspanMeters: dimensions.realWingspanMeters,
    engines: [
      new THREE.Vector3(-1.05, -0.1, 4.23),
      new THREE.Vector3(1.05, -0.1, 4.23),
    ],
    detailTags: [
      "tandem-canopy",
      "variable-sweep-wings",
      "20-68-degree-wing-sweep",
      "fixed-glove-pylons",
      "four-fuselage-pallets",
      "twin-nacelles",
      "twin-tails",
      "stabilators",
      "intake-ramps",
      "ventral-fins",
      "arresting-hook",
    ],
    lodNear: 88,
    lodMedium: 250,
  });
  finished.userData.modelAssetVersion = "v1.1-ultra";
  finished.userData.referenceDimensions = dimensions;
  return finished;
}
