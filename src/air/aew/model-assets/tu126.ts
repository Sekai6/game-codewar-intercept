import * as THREE from "three";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../../model-assets/dimensions.js";
import {
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
  createStarGeometry,
  createVerticalSurface,
  finishAircraftModel,
  type AircraftModelTiers,
  type FuselageStation,
} from "../../model-assets/model-kit.js";
import {
  createAewPropeller,
  registerAewModelAnimation,
  type AewPropellerAnimationHandle,
} from "./animation.js";

type DetailTier = "ultra" | "high" | "low";

const DIMENSIONS = AIRCRAFT_REFERENCE_DIMENSIONS.TU126;
const HALF_SPAN = DIMENSIONS.modelWingspan * 0.5;
const HALF_AIRFRAME = DIMENSIONS.modelAirframeLength * 0.5;
const ROTODOME_RADIUS = DIMENSIONS.modelRotodomeDiameter * 0.5;
const PROPELLER_RADIUS = DIMENSIONS.modelPropellerDiameter * 0.5;

const skin = aircraftPaint(0xb7b8b2, 0.5, 0.16);
const lowerSkin = aircraftPaint(0x9fa5a3, 0.53, 0.15);
const domeSkin = aircraftPaint(0xc8c5b9, 0.56, 0.13);
const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0x303738, metalness: 0.44, roughness: 0.4 });
const redPaint = new THREE.MeshStandardMaterial({ color: 0xb71f26, metalness: 0.18, roughness: 0.58, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const yellowPaint = new THREE.MeshStandardMaterial({ color: 0xe7c84b, metalness: 0.12, roughness: 0.62, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const exhaustMaterial = new THREE.MeshStandardMaterial({ color: 0x303636, metalness: 0.62, roughness: 0.34 });

const FUSELAGE_STATIONS: readonly FuselageStation[] = [
  { z: -HALF_AIRFRAME, radiusX: 0.08, radiusY: 0.07, centerY: -0.08 },
  { z: -13.28, radiusX: 0.34, radiusY: 0.29, centerY: -0.06 },
  { z: -13.0, radiusX: 0.62, radiusY: 0.52, centerY: -0.035 },
  { z: -12.55, radiusX: 0.82, radiusY: 0.73, centerY: -0.005 },
  { z: -11.9, radiusX: 0.98, radiusY: 0.91, centerY: 0.025 },
  { z: -10.8, radiusX: 1.04, radiusY: 1.02, centerY: 0.035 },
  { z: -8.4, radiusX: 1.06, radiusY: 1.06, centerY: 0.025 },
  { z: -5.0, radiusX: 1.07, radiusY: 1.075, centerY: 0.01 },
  { z: -1.5, radiusX: 1.07, radiusY: 1.08, centerY: 0 },
  { z: 2.3, radiusX: 1.065, radiusY: 1.075, centerY: 0.005 },
  { z: 5.4, radiusX: 1.02, radiusY: 1.04, centerY: 0.02 },
  { z: 8.2, radiusX: 0.93, radiusY: 0.96, centerY: 0.04 },
  { z: 10.0, radiusX: 0.78, radiusY: 0.84, centerY: 0.055 },
  { z: 11.2, radiusX: 0.61, radiusY: 0.67, centerY: 0.07 },
  { z: 12.35, radiusX: 0.42, radiusY: 0.47, centerY: 0.08 },
  { z: 13.0, radiusX: 0.2, radiusY: 0.23, centerY: 0.075 },
  { z: HALF_AIRFRAME, radiusX: 0.07, radiusY: 0.08, centerY: 0.06 },
] as const;

// Keep the final tail-cone stations in the reduced mesh.  This is deliberately
// explicit rather than reusing the pre-detail indices, so Low remains a
// continuous Tu-114-derived airframe with attached tail surfaces.
const LOW_FUSELAGE_STATIONS = FUSELAGE_STATIONS.filter((_, index) =>
  index === 0 || index === 2 || index === 4 || index === 6 || index === 8 || index === 10 || index === 12 || index === 14 || index === 16,
);

function tierSegments(tier: DetailTier) {
  return tier === "ultra" ? 72 : tier === "high" ? 42 : 14;
}

function createWing(side: number, tier: DetailTier) {
  // The Tu-126 inherits the Tu-114's high, strongly swept wing.  Keep a
  // broad root chord for the four NK-12 nacelles, then taper through a clear
  // outer panel instead of the old single triangular slab.
  const wing = createPlanform([
    [0, -3.05],
    [side * 3.05, -2.52],
    [side * 8.35, -1.18],
    [side * HALF_SPAN, -0.34],
    [side * HALF_SPAN, 0.34],
    [side * 8.35, 0.28],
    [side * 3.05, 1.54],
    [0, 2.04],
  ], skin, tier === "low" ? 0.14 : tier === "high" ? 0.2 : 0.27);
  wing.position.y = 0.72;
  wing.rotation.z = -side * 0.015;
  return wing;
}

function addWingSurfaceDetail(tierRoot: THREE.Group, side: number, tier: DetailTier) {
  if (tier === "low") return;
  const thickness = tier === "ultra" ? 0.025 : 0.018;
  const flap = createPlanform([
    [side * 0.7, 0.95],
    [side * 3.05, 1.14],
    [side * 8.25, 0.0],
    [side * 8.25, 0.24],
    [side * 3.05, 1.42],
    [side * 0.7, 1.28],
  ], aircraftPanelMaterial, thickness);
  flap.position.y = 0.86;
  tierRoot.add(flap);
  const slat = createPlanform([
    [side * 0.6, -2.7],
    [side * 3.1, -2.18],
    [side * 8.27, -0.94],
    [side * 8.27, -0.78],
    [side * 3.1, -1.96],
    [side * 0.6, -2.49],
  ], aircraftPanelMaterial, thickness);
  slat.position.y = 0.86;
  tierRoot.add(slat);
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.026, 1.65), aircraftPanelMaterial);
  fold.position.set(side * 8.35, 0.86, -0.45);
  fold.rotation.y = side * -0.15;
  tierRoot.add(fold);
  if (tier === "ultra") {
    for (const z of [-1.2, -0.82, -0.36, 0.06, 0.32]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.22), aircraftPanelMaterial);
      rib.position.set(side * 7.62, 0.875, z);
      rib.rotation.y = side * -0.15;
      tierRoot.add(rib);
    }
  }
}

function createTailplane(side: number, tier: DetailTier) {
  const tail = createPlanform([
    [0, -1.0],
    [side * 2.9, -0.02],
    [side * 4.55, 0.56],
    [side * 4.55, 1.35],
    [side * 2.9, 0.97],
    [0, 1.23],
  ], skin, tier === "low" ? 0.11 : 0.17);
  tail.position.set(0, 0.92, 10.68);
  return tail;
}

function addCockpitGlazing(tierRoot: THREE.Group, tier: DetailTier) {
  // Tu-126 retained the Tu-114's glazed navigator/bombardier nose.  A shallow
  // continuous shell under the panes prevents the cockpit from reading as
  // two detached black rectangles in side and front views.
  const canopyStations: readonly FuselageStation[] = [
    { z: -13.16, radiusX: 0.07, radiusY: 0.035, centerY: 0.28 },
    { z: -12.95, radiusX: 0.36, radiusY: 0.16, centerY: 0.36 },
    { z: -12.62, radiusX: 0.66, radiusY: 0.28, centerY: 0.47 },
    { z: -12.22, radiusX: 0.78, radiusY: 0.35, centerY: 0.53 },
    { z: -11.9, radiusX: 0.67, radiusY: 0.31, centerY: 0.49 },
    { z: -11.62, radiusX: 0.3, radiusY: 0.14, centerY: 0.39 },
  ];
  const shell = createLoftedFuselage(
    tier === "low" ? canopyStations.filter((_, index) => index % 2 === 0 || index === canopyStations.length - 1) : canopyStations,
    aircraftGlassMaterial,
    tier === "ultra" ? 48 : tier === "high" ? 26 : 12,
  );
  shell.name = `tu126-cockpit-shell:${tier}`;
  tierRoot.add(shell);

  if (tier === "low") {
    const glazing = new THREE.Group();
    glazing.name = "tu126-cockpit:low";
    for (const side of [-1, 1]) {
      const frontPane = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.045), aircraftGlassMaterial);
      frontPane.position.set(side * 0.34, 0.46, -12.66);
      frontPane.rotation.y = side * 0.09;
      const sidePane = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.27, 0.56), aircraftGlassMaterial);
      sidePane.position.set(side * 0.88, 0.4, -12.13);
      glazing.add(frontPane, sidePane);
    }
    tierRoot.add(glazing);
    return;
  }

  const cockpit = new THREE.Group();
  cockpit.name = `tu126-cockpit:${tier}`;
  for (const side of [-1, 1]) {
    const frontFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.43, 0.06), aircraftDarkMaterial);
    frontFrame.position.set(side * 0.39, 0.48, -12.66);
    frontFrame.rotation.y = side * 0.09;
    const frontPane = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.07), aircraftGlassMaterial);
    frontPane.position.set(side * 0.39, 0.48, -12.69);
    frontPane.rotation.y = side * 0.09;
    cockpit.add(frontFrame, frontPane);
    const sidePane = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.72), aircraftGlassMaterial);
    sidePane.position.set(side * 0.88, 0.43, -12.12);
    cockpit.add(sidePane);
  }
  if (tier === "ultra") {
    for (const side of [-1, 1]) {
      const lowerPane = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.25, 0.045), aircraftGlassMaterial);
      lowerPane.position.set(side * 0.27, -0.22, -13.04);
      lowerPane.rotation.y = side * 0.18;
      cockpit.add(lowerPane);
    }
    const centreBow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.055), aircraftDarkMaterial);
    centreBow.position.set(0, 0.53, -12.28);
    centreBow.rotation.x = -0.08;
    cockpit.add(centreBow);
    for (const side of [-1, 1]) {
      const roofBow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.58), aircraftDarkMaterial);
      roofBow.position.set(side * 0.32, 0.79, -12.22);
      roofBow.rotation.y = side * 0.08;
      cockpit.add(roofBow);
    }
  }
  tierRoot.add(cockpit);
}

function addCabinWindows(tierRoot: THREE.Group, tier: DetailTier) {
  if (tier === "low") return;
  const positions = tier === "ultra"
    ? [-9.8, -8.65, -7.5, -6.35, -5.2, -4.05, -2.9, -1.75, -0.6, 0.55, 1.7, 2.85, 4.0, 5.15]
    : [-9.2, -7.0, -4.8, -2.6, -0.4, 1.8, 4.0];
  const geometry = new THREE.BoxGeometry(0.035, tier === "ultra" ? 0.18 : 0.16, tier === "ultra" ? 0.26 : 0.23);
  const windows = new THREE.InstancedMesh(geometry, aircraftGlassMaterial, positions.length * 2);
  windows.name = `tu126-cabin-windows:${tier}`;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const side of [-1, 1]) for (const z of positions) {
    matrix.compose(
      new THREE.Vector3(side * 1.067, 0.22, z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    );
    windows.setMatrixAt(index++, matrix);
  }
  windows.instanceMatrix.needsUpdate = true;
  windows.computeBoundingBox();
  windows.computeBoundingSphere();
  tierRoot.add(windows);
  if (tier === "ultra") {
    // Thin frame bars preserve the characteristic Tu-114 cabin rhythm at
    // close range without turning the Low tier into a wall of geometry.
    for (const side of [-1, 1]) {
      for (const z of positions) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.23, 0.035), aircraftPanelMaterial);
        frame.position.set(side * 1.09, 0.22, z);
        tierRoot.add(frame);
      }
    }
  }
}

function createSovietTailMarking(side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `tu126-tail-star:${side < 0 ? "port" : "starboard"}:${tier}`;
  const radius = tier === "ultra" ? 0.42 : 0.35;
  const border = new THREE.Mesh(createStarGeometry(radius), yellowPaint);
  const star = new THREE.Mesh(createStarGeometry(radius * 0.83), redPaint);
  star.position.z = 0.008;
  group.add(border, star);
  group.rotation.y = side * Math.PI / 2;
  const finHalfThickness = tier === "ultra" ? 0.135 : 0.11;
  group.position.set(side * (finHalfThickness + 0.006), 4.15, 11.25);
  return group;
}

function makeDoubleSided(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
}

function addWingMarking(wing: THREE.Mesh, side: number, tier: DetailTier) {
  if (tier === "low") return;
  const marking = createNationalMarking("ussr", tier === "ultra" ? 0.47 : 0.39);
  makeDoubleSided(marking);
  marking.position.set(side * 8.35, tier === "ultra" ? 0.155 : 0.12, 1.2);
  marking.rotation.z = side < 0 ? Math.PI : 0;
  wing.add(marking);
}

function createNacelle(
  tierRoot: THREE.Group,
  side: number,
  station: "inner" | "outer",
  tier: DetailTier,
): AewPropellerAnimationHandle {
  const inner = station === "inner";
  const x = side * (inner ? 4.48 : 8.62);
  const z = inner ? -0.92 : 1.12;
  const nacelle = new THREE.Group();
  nacelle.name = `tu126-engine:${station}:${side < 0 ? "port" : "starboard"}:${tier}`;
  // NK-12 nacelles hang beneath the high wing, not beneath the fuselage
  // centreline.  Raising the assembly exposes the correct high-wing stance
  // in the front view while leaving the propeller diameter unchanged.
  nacelle.position.set(x, 0.2, z);
  const nacelleStations: readonly FuselageStation[] = [
    { z: -3.08, radiusX: 0.28, radiusY: 0.27, centerY: -0.03 },
    { z: -2.82, radiusX: 0.52, radiusY: 0.49, centerY: -0.02 },
    { z: -2.48, radiusX: 0.66, radiusY: 0.61, centerY: -0.01 },
    { z: -1.72, radiusX: 0.74, radiusY: 0.7, centerY: 0 },
    { z: -0.45, radiusX: 0.73, radiusY: 0.68, centerY: 0.01 },
    { z: 0.72, radiusX: 0.68, radiusY: 0.64, centerY: 0.02 },
    { z: 1.52, radiusX: 0.55, radiusY: 0.54, centerY: 0.02 },
    { z: 2.18, radiusX: 0.36, radiusY: 0.37, centerY: 0.02 },
    { z: 2.58, radiusX: 0.16, radiusY: 0.18, centerY: 0.02 },
  ];
  nacelle.add(createLoftedFuselage(
    tier === "low" ? nacelleStations.filter((_, index) => index !== 1 && index !== 4) : nacelleStations,
    lowerSkin,
    tierSegments(tier),
  ));
  if (inner) {
    const gearFairingStations: readonly FuselageStation[] = [
      { z: 0.25, radiusX: 0.28, radiusY: 0.24, centerY: -0.52 },
      { z: 1.4, radiusX: 0.43, radiusY: 0.36, centerY: -0.55 },
      { z: 2.65, radiusX: 0.38, radiusY: 0.32, centerY: -0.5 },
      { z: 3.45, radiusX: 0.12, radiusY: 0.12, centerY: -0.36 },
    ];
    nacelle.add(createLoftedFuselage(gearFairingStations, lowerSkin, tierSegments(tier)));
  }
  if (tier !== "low") {
    const intakeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, tier === "ultra" ? 0.052 : tier === "high" ? 0.068 : 0.08, tier === "ultra" ? 10 : 7, tier === "ultra" ? 56 : tier === "high" ? 32 : 16),
      aircraftPanelMaterial,
    );
    intakeRing.position.z = -3.1;
    nacelle.add(intakeRing);
    const intakeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.442, tier === "ultra" ? 40 : tier === "high" ? 24 : 12),
      aircraftDarkMaterial,
    );
    intakeDisc.rotation.y = Math.PI;
    intakeDisc.position.z = -3.11;
    nacelle.add(intakeDisc);
    for (const exhaustSide of [-1, 1]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.74, tier === "ultra" ? 18 : 10, 1, true), exhaustMaterial);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(exhaustSide * 0.5, -0.02, 1.34);
      nacelle.add(exhaust);
      if (tier === "ultra") {
        const exhaustRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 28), aircraftPanelMaterial);
        exhaustRing.rotation.x = Math.PI / 2;
        exhaustRing.position.set(exhaustSide * 0.5, -0.02, 1.72);
        nacelle.add(exhaustRing);
      }
    }
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, inner ? 2.25 : 1.65), skin);
    pylon.position.set(0, 0.62, inner ? -0.3 : -0.08);
    pylon.rotation.x = side * 0.045;
    nacelle.add(pylon);
    if (tier === "ultra") {
      addPanelLine(nacelle, [0, 0.76, -1.35], [0.46, 0.014, 0.025]);
      const gearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, inner ? 2.25 : 0.9), aircraftPanelMaterial);
      gearDoor.position.set(0, -0.7, inner ? 1.55 : 0.45);
      nacelle.add(gearDoor);
      for (const z of [-2.35, -1.5, -0.45, 0.5, 1.25]) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 5, 40), aircraftPanelMaterial);
        seam.scale.y = 0.96;
        seam.position.z = z;
        nacelle.add(seam);
      }
    }
  }

  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0xa4aeab,
    transparent: true,
    opacity: tier === "low" ? 0.12 : tier === "high" ? 0.05 : 0.022,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propeller = createAewPropeller({
    radius: PROPELLER_RADIUS,
    hubRadius: tier === "ultra" ? 0.34 : 0.31,
    spinnerLength: 0.72,
    bladeMaterial,
    hubMaterial: aircraftDarkMaterial,
    blurMaterial,
    rotors: [
      { direction: 1, axialOffset: -0.13, phase: 0, bladeCount: 4 },
      { direction: -1, axialOffset: 0.13, phase: Math.PI / 4, bladeCount: 4 },
    ],
    bladeRootRadius: 0.34,
    bladeRootChord: 0.26,
    bladeMidChord: 0.21,
    bladeTipChord: 0.1,
    bladeThickness: 0.035,
    detailed: tier === "ultra",
    blurOnly: tier === "low",
  });
  propeller.object.position.z = -3.34;
  nacelle.add(propeller.object);
  tierRoot.add(nacelle);
  return propeller;
}

function createRotodome(tierRoot: THREE.Group, tier: DetailTier) {
  const pylonBaseY = 1.02;
  const pylonZ = 2.0;
  const pylon = createVerticalSurface([
    [-1.42, 0],
    [1.48, 0],
    [0.79, DIMENSIONS.modelRotodomeSupportHeight],
    [-0.52, DIMENSIONS.modelRotodomeSupportHeight],
  ], tier === "low" ? 0.46 : tier === "high" ? 0.62 : 0.72, skin);
  pylon.name = `tu126-liana-pylon:${tier}`;
  pylon.position.set(0, pylonBaseY, pylonZ);
  tierRoot.add(pylon);
  if (tier === "ultra") {
    const accessPanel = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.54, 0.025), aircraftPanelMaterial);
    accessPanel.position.set(0, pylonBaseY + 0.56, pylonZ - 1.13);
    tierRoot.add(accessPanel);
    for (const x of [-0.22, 0, 0.22]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.44), aircraftPanelMaterial);
      vent.position.set(x, pylonBaseY + 0.22, pylonZ - 1.22);
      tierRoot.add(vent);
    }
    for (const side of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.24, 0.19), lowerSkin);
      brace.position.set(side * 0.62, pylonBaseY + 0.55, pylonZ - 0.12);
      brace.rotation.z = side * -0.27;
      tierRoot.add(brace);
    }
  }

  const rotodome = new THREE.Group();
  rotodome.name = `tu126-liana-rotodome:${tier}`;
  rotodome.position.set(
    0,
    pylonBaseY + DIMENSIONS.modelRotodomeSupportHeight + DIMENSIONS.modelRotodomeThickness * 0.5,
    pylonZ,
  );
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, tier === "ultra" ? 84 : tier === "high" ? 46 : 20, tier === "ultra" ? 30 : tier === "high" ? 16 : 10),
    domeSkin,
  );
  shell.scale.set(ROTODOME_RADIUS, DIMENSIONS.modelRotodomeThickness * 0.5, ROTODOME_RADIUS);
  rotodome.add(shell);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ROTODOME_RADIUS * 0.974, tier === "ultra" ? 0.065 : tier === "high" ? 0.08 : 0.095, tier === "ultra" ? 12 : 8, tier === "ultra" ? 84 : tier === "high" ? 46 : 28),
    aircraftDarkMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  rotodome.add(rim);
  const orientationBand = new THREE.Mesh(
    new THREE.BoxGeometry(ROTODOME_RADIUS * 1.74, 0.055, tier === "ultra" ? 0.11 : 0.15),
    aircraftPanelMaterial,
  );
  orientationBand.position.y = DIMENSIONS.modelRotodomeThickness * 0.5;
  rotodome.add(orientationBand);
  if (tier !== "low") {
    const lowerRing = new THREE.Mesh(
      new THREE.TorusGeometry(ROTODOME_RADIUS * 0.76, tier === "ultra" ? 0.035 : 0.045, 6, tier === "ultra" ? 64 : 34),
      aircraftPanelMaterial,
    );
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = -DIMENSIONS.modelRotodomeThickness * 0.34;
    rotodome.add(lowerRing);
  }
  if (tier === "ultra") {
    for (const z of [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]) {
      const inspectionStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.28), aircraftPanelMaterial);
      inspectionStrip.position.set(0, DIMENSIONS.modelRotodomeThickness * 0.51, z);
      rotodome.add(inspectionStrip);
    }
  }
  tierRoot.add(rotodome);
  return rotodome;
}

function addForwardDetails(tierRoot: THREE.Group, tier: DetailTier) {
  const probe = new THREE.Mesh(
    new THREE.CylinderGeometry(tier === "low" ? 0.045 : 0.038, tier === "low" ? 0.07 : 0.06, DIMENSIONS.modelRefuelingProbeLength, tier === "ultra" ? 10 : 7),
    aircraftDarkMaterial,
  );
  probe.rotation.x = Math.PI / 2;
  probe.position.set(0, 0.03, -HALF_AIRFRAME - DIMENSIONS.modelRefuelingProbeLength * 0.5);
  tierRoot.add(probe);
  if (tier !== "low") {
    const coolingIntake = new THREE.Group();
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 1.36), lowerSkin);
    const throat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.12), aircraftDarkMaterial);
    throat.position.set(0, -0.11, -0.69);
    coolingIntake.add(fairing, throat);
    coolingIntake.position.set(0, -0.94, -9.8);
    coolingIntake.rotation.x = -0.08;
    tierRoot.add(coolingIntake);
  }
}

function buildTier(root: THREE.Group, tierRoot: THREE.Group, tier: DetailTier) {
  tierRoot.name = `tu126:${tier}`;
  tierRoot.add(createLoftedFuselage(
    tier === "low" ? LOW_FUSELAGE_STATIONS : FUSELAGE_STATIONS,
    skin,
    tierSegments(tier),
  ));
  addCockpitGlazing(tierRoot, tier);
  addCabinWindows(tierRoot, tier);
  addForwardDetails(tierRoot, tier);
  for (const side of [-1, 1]) {
    const wing = createWing(side, tier);
    addWingMarking(wing, side, tier);
    tierRoot.add(wing, createTailplane(side, tier));
    addWingSurfaceDetail(tierRoot, side, tier);
    addNavigationLight(root, tierRoot, side, [side * HALF_SPAN, 0.78, 0], tier === "low" ? 0.11 : 0.085);
  }
  if (tier !== "low") {
    const wingRootFairing = createPlanform([
      [-2.35, -2.75],
      [2.35, -2.75],
      [2.45, 1.72],
      [1.5, 2.08],
      [-1.5, 2.08],
      [-2.45, 1.72],
    ], skin, tier === "ultra" ? 0.34 : 0.26);
    wingRootFairing.position.y = 0.72;
    tierRoot.add(wingRootFairing);
    for (const side of [-1, 1]) {
      const entryDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.88, 0.58),
        lowerSkin,
      );
      entryDoor.position.set(side * 1.07, -0.02, side < 0 ? -6.25 : 6.05);
      tierRoot.add(entryDoor);
    }
  }

  const fin = createVerticalSurface([
    [-2.55, 0],
    [2.58, 0],
    [1.78, 5.27],
    [0.12, 5.27],
    [0.54, 4.32],
  ], tier === "low" ? 0.17 : tier === "high" ? 0.22 : 0.27, skin);
  fin.position.set(0, 0.72, 10.55);
  tierRoot.add(fin);
  if (tier !== "low") {
    const rudder = createVerticalSurface([
      [0.42, 0.15],
      [2.32, 0.15],
      [1.6, 4.9],
      [0.5, 4.18],
    ], tier === "ultra" ? 0.04 : 0.032, aircraftPanelMaterial);
    rudder.position.set(0, 0.73, 10.58);
    tierRoot.add(rudder);
    if (tier === "ultra") {
      for (const y of [1.35, 2.15, 2.95, 3.75, 4.5]) {
        addPanelLine(fin, [0, y, 0.55], [0.03, 0.016, 1.35 - y * 0.11]);
      }
    }
  }
  const ventralFin = createVerticalSurface([
    [-1.24, 0],
    [1.22, 0],
    [0.7, -1.15],
    [-0.2, -1.15],
  ], tier === "low" ? 0.15 : 0.2, lowerSkin);
  ventralFin.position.set(0, -0.62, 10.62);
  tierRoot.add(ventralFin);
  if (tier !== "low") {
    tierRoot.add(createSovietTailMarking(-1, tier), createSovietTailMarking(1, tier));
    const tailEcmFairing = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, tier === "ultra" ? 28 : 16, tier === "ultra" ? 16 : 9),
      aircraftPanelMaterial,
    );
    tailEcmFairing.scale.set(0.42, 0.38, 1.35);
    tailEcmFairing.position.set(0, 0.05, 12.72);
    tierRoot.add(tailEcmFairing);
    const tailTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.27, 0.5, tier === "ultra" ? 20 : 12),
      aircraftDarkMaterial,
    );
    tailTurret.rotation.x = Math.PI / 2;
    tailTurret.position.set(0, -0.06, 13.42);
    tierRoot.add(tailTurret);
    if (tier === "ultra") {
      for (const side of [-1, 1]) {
        const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.08), lowerSkin);
        antenna.position.set(side * 0.32, 0.72, 9.42);
        antenna.rotation.z = side * 0.16;
        tierRoot.add(antenna);
      }
    }
  }
  if (tier === "ultra") {
    [-9.2, -5.1, -0.8, 3.9, 8.0].forEach((z) => {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(1.055, 0.012, 4, 34), aircraftPanelMaterial);
      seam.scale.y = 0.99;
      seam.position.z = z;
      tierRoot.add(seam);
    });
    const dorsalAntenna = createVerticalSurface([[-0.26, 0], [0.31, 0], [0.15, 0.55], [-0.08, 0.55]], 0.065, lowerSkin);
    dorsalAntenna.position.set(0, 1.02, 7.45);
    tierRoot.add(dorsalAntenna);
  }

  const props = [
    createNacelle(tierRoot, -1, "inner", tier),
    createNacelle(tierRoot, 1, "inner", tier),
    createNacelle(tierRoot, -1, "outer", tier),
    createNacelle(tierRoot, 1, "outer", tier),
  ];
  const rotodome = createRotodome(tierRoot, tier);
  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(tier === "low" ? 0.1 : 0.075, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8f2ef }),
  );
  tailLight.position.set(0, 0.1, HALF_AIRFRAME - 0.08);
  tierRoot.add(tailLight);
  return { props, rotodome };
}

export function createTu126Model() {
  const root = new THREE.Group();
  root.name = "Tu-126 Moss / late-series Liana AEW asset";
  const tiers: AircraftModelTiers = createAircraftTiers(root);
  tiers.high.visible = false;
  tiers.low.visible = false;
  const ultra = buildTier(root, tiers.ultra, "ultra");
  const high = buildTier(root, tiers.high, "high");
  const low = buildTier(root, tiers.low, "low");
  registerAewModelAnimation(root, {
    rotodomes: [ultra.rotodome, high.rotodome, low.rotodome],
    propellers: [...ultra.props, ...high.props, ...low.props],
  }, {
    rotodome: ultra.rotodome,
    propellers: ultra.props.map((propeller) => propeller.object),
  });
  root.userData.modelVariant = "Tu-126 late series / Liana / SPS-100 tail fairing";
  root.userData.referenceDimensions = DIMENSIONS;
  root.userData.propellerBladeCount = 8;
  root.userData.rotorSetsPerEngine = 2;
  root.userData.contraRotatingPropellers = true;
  const finished = finishAircraftModel(root, tiers, {
    length: DIMENSIONS.modelLength,
    realLengthMeters: DIMENSIONS.realLengthMeters,
    realWingspanMeters: DIMENSIONS.realWingspanMeters,
    engines: [],
    lodNear: 190,
    lodMedium: 480,
    detailTags: [
      "quality-aware-ultra-high-low",
      "full-relative-2m-per-unit-scale",
      "four-nk12-contra-rotating-propellers",
      "tu114-derived-swept-wing",
      "refueling-probe-and-ventral-fin",
      "11m-liana-lenticular-rotodome",
      "late-series-ecm-tail-fairing",
      "land-based-aew",
    ],
  });
  finished.userData.airframeLength = DIMENSIONS.modelAirframeLength;
  finished.userData.refuelingProbeLength = DIMENSIONS.modelRefuelingProbeLength;
  finished.userData.rotodomeDiameter = DIMENSIONS.modelRotodomeDiameter;
  finished.userData.rotodomeThickness = DIMENSIONS.modelRotodomeThickness;
  finished.userData.rotodomeSupportHeight = DIMENSIONS.modelRotodomeSupportHeight;
  finished.userData.modelAssetVersion = "v1.1-ultra";
  return finished;
}
