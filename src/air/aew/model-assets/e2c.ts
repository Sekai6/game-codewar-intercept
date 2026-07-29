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

const DIMENSIONS = AIRCRAFT_REFERENCE_DIMENSIONS.E2C;
const HALF_SPAN = DIMENSIONS.modelWingspan * 0.5;
const ROTODOME_RADIUS = DIMENSIONS.modelRotodomeDiameter * 0.5;
const PROPELLER_RADIUS = DIMENSIONS.modelPropellerDiameter * 0.5;

const skin = aircraftPaint(0xaeb5b4, 0.46, 0.16);
const domeSkin = aircraftPaint(0xd1d2c7, 0.54, 0.13);
const whitePaint = aircraftPaint(0xe2e3dc, 0.55, 0.12);
const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0x343c3d, metalness: 0.42, roughness: 0.4 });
const exhaustMaterial = new THREE.MeshStandardMaterial({ color: 0x343a39, metalness: 0.58, roughness: 0.36 });
const windowFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2528, metalness: 0.45, roughness: 0.42 });
const markingWhite = new THREE.MeshStandardMaterial({ color: 0xe7ece8, roughness: 0.68, side: THREE.DoubleSide });
const markingBlue = new THREE.MeshStandardMaterial({ color: 0x214c78, roughness: 0.66, side: THREE.DoubleSide });

// The Hawkeye has a short, rounded nose, a deep centre cabin and a visibly
// pinched tail cone.  Extra stations are intentional: the old four-cylinder
// look made the aircraft read like a generic tube in the Ultra gallery.
const FUSELAGE_STATIONS: readonly FuselageStation[] = [
  { z: -4.4, radiusX: 0.035, radiusY: 0.028, centerY: -0.075 },
  { z: -4.3, radiusX: 0.17, radiusY: 0.13, centerY: -0.07 },
  { z: -4.12, radiusX: 0.36, radiusY: 0.28, centerY: -0.045 },
  { z: -3.86, radiusX: 0.53, radiusY: 0.43, centerY: -0.005 },
  { z: -3.48, radiusX: 0.64, radiusY: 0.56, centerY: 0.035 },
  { z: -3.0, radiusX: 0.69, radiusY: 0.65, centerY: 0.045 },
  { z: -2.38, radiusX: 0.71, radiusY: 0.69, centerY: 0.025 },
  { z: -1.25, radiusX: 0.7, radiusY: 0.7, centerY: 0.005 },
  { z: 0.45, radiusX: 0.68, radiusY: 0.69, centerY: -0.005 },
  { z: 1.75, radiusX: 0.64, radiusY: 0.66, centerY: 0.005 },
  { z: 2.58, radiusX: 0.56, radiusY: 0.59, centerY: 0.025 },
  { z: 3.25, radiusX: 0.43, radiusY: 0.48, centerY: 0.045 },
  { z: 3.76, radiusX: 0.29, radiusY: 0.34, centerY: 0.045 },
  { z: 4.13, radiusX: 0.14, radiusY: 0.17, centerY: 0.035 },
  { z: 4.4, radiusX: 0.035, radiusY: 0.03, centerY: 0.025 },
] as const;

// Preserve the complete nose-to-tail envelope when deriving the low tier;
// sampling the old indices after adding stations used to truncate the rear
// fuselage and leave the tail surfaces floating.
const LOW_FUSELAGE_STATIONS = FUSELAGE_STATIONS.filter((_, index) =>
  index === 0 || index === 2 || index === 4 || index === 6 || index === 8 || index === 10 || index === 12 || index === 14,
);

function tierSegments(tier: DetailTier) {
  return tier === "ultra" ? 96 : tier === "high" ? 52 : 14;
}

function addCockpit(tierRoot: THREE.Group, tier: DetailTier) {
  // A shallow, faceted windscreen shell gives the E-2C its characteristic
  // blunt two-seat nose.  Individual panes are layered over it below so the
  // silhouette stays continuous even when viewed from the underside.
  const canopyStations: readonly FuselageStation[] = [
    { z: -4.12, radiusX: 0.07, radiusY: 0.035, centerY: 0.30 },
    { z: -3.95, radiusX: 0.31, radiusY: 0.14, centerY: 0.38 },
    { z: -3.68, radiusX: 0.53, radiusY: 0.24, centerY: 0.46 },
    { z: -3.36, radiusX: 0.58, radiusY: 0.27, centerY: 0.48 },
    { z: -3.08, radiusX: 0.47, radiusY: 0.22, centerY: 0.43 },
    { z: -2.88, radiusX: 0.12, radiusY: 0.07, centerY: 0.34 },
  ];
  const shell = createLoftedFuselage(
    tier === "low" ? canopyStations.filter((_, index) => index % 2 === 0 || index === canopyStations.length - 1) : canopyStations,
    aircraftGlassMaterial,
    tier === "ultra" ? 48 : tier === "high" ? 26 : 12,
  );
  shell.name = `e2c-cockpit-shell:${tier}`;
  tierRoot.add(shell);

  if (tier === "low") {
    const glazing = new THREE.Group();
    glazing.name = "e2c-cockpit:low";
    for (const side of [-1, 1]) {
      const frontPane = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.21, 0.035), aircraftGlassMaterial);
      frontPane.position.set(side * 0.21, 0.42, -3.82);
      frontPane.rotation.y = side * 0.12;
      const sidePane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.19, 0.34), aircraftGlassMaterial);
      sidePane.position.set(side * 0.57, 0.37, -3.53);
      glazing.add(frontPane, sidePane);
    }
    tierRoot.add(glazing);
    return;
  }

  const paneCount = tier === "ultra" ? 6 : 4;
  const panes = new THREE.Group();
  panes.name = `e2c-cockpit:${tier}`;
  const frontPositions: readonly [number, number, number, number][] = [
    [-0.24, 0.43, -3.83, -0.14],
    [0.24, 0.43, -3.83, 0.14],
  ];
  frontPositions.forEach(([x, y, z, yaw]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.27, 0.038), windowFrameMaterial);
    frame.position.set(x, y, z + 0.012);
    frame.rotation.y = yaw;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.215, 0.045), aircraftGlassMaterial);
    pane.position.set(x, y, z);
    pane.rotation.y = yaw;
    panes.add(frame, pane);
  });
  for (const side of [-1, 1]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.27, 0.48), windowFrameMaterial);
    frame.position.set(side * 0.565, 0.4, -3.56);
    frame.rotation.x = -0.08;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.215, 0.4), aircraftGlassMaterial);
    pane.position.set(side * 0.572, 0.4, -3.56);
    pane.rotation.x = -0.08;
    panes.add(frame, pane);
  }
  if (paneCount === 6) {
    for (const side of [-1, 1]) {
      const quarter = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.28), aircraftGlassMaterial);
      quarter.position.set(side * 0.61, 0.34, -3.28);
      quarter.rotation.x = -0.06;
      panes.add(quarter);
    }
  }
  // Narrow roof bows and a centre mullion are visible on real Hawkeye
  // glazing, but remain flush with the shell (no floating black boxes).
  const centreBow = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.23, 0.52),
    windowFrameMaterial,
  );
  centreBow.position.set(0, 0.55, -3.56);
  centreBow.rotation.x = -0.08;
  panes.add(centreBow);
  if (tier === "ultra") {
    for (const side of [-1, 1]) {
      const roofBow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.45), windowFrameMaterial);
      roofBow.position.set(side * 0.28, 0.62, -3.55);
      roofBow.rotation.y = side * 0.08;
      panes.add(roofBow);
    }
  }
  tierRoot.add(panes);
}

function createWing(side: number, tier: DetailTier) {
  // High-mounted, modestly swept Hawkeye wing: broad inboard panel, a short
  // straight outer panel and a separate folding joint near the engine.  The
  // previous single triangle hid both the fold and the trailing-edge taper.
  const wing = createPlanform([
    [0, -1.22],
    [side * 1.2, -1.18],
    [side * 2.9, -1.02],
    [side * 4.28, -0.73],
    [side * HALF_SPAN, -0.47],
    [side * HALF_SPAN, 0.39],
    [side * 4.28, 0.58],
    [side * 2.9, 0.91],
    [side * 1.2, 1.2],
    [0, 1.28],
  ], skin, tier === "low" ? 0.075 : tier === "high" ? 0.105 : 0.135);
  wing.position.y = 0.46;
  wing.rotation.z = side * 0.009;
  return wing;
}

function addWingSurfaceDetail(tierRoot: THREE.Group, side: number, tier: DetailTier) {
  if (tier === "low") return;
  const flapThickness = tier === "ultra" ? 0.018 : 0.014;
  const flap = createPlanform([
    [side * 0.55, 0.54],
    [side * 2.84, 0.53],
    [side * 4.22, 0.37],
    [side * 4.22, 0.5],
    [side * 2.84, 0.71],
    [side * 0.55, 0.78],
  ], aircraftPanelMaterial, flapThickness);
  flap.position.y = 0.535;
  tierRoot.add(flap);
  const slat = createPlanform([
    [side * 0.5, -1.13],
    [side * 2.85, -0.94],
    [side * 4.22, -0.65],
    [side * 4.22, -0.57],
    [side * 2.85, -0.83],
    [side * 0.5, -1.02],
  ], aircraftPanelMaterial, flapThickness);
  slat.position.y = 0.54;
  tierRoot.add(slat);
  const fold = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.022, 1.05),
    aircraftPanelMaterial,
  );
  fold.position.set(side * 4.28, 0.54, -0.02);
  fold.rotation.y = side * -0.08;
  tierRoot.add(fold);
  if (tier === "ultra") {
    for (const z of [-0.72, -0.42, 0.16, 0.43]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.18), aircraftPanelMaterial);
      rib.position.set(side * 3.65, 0.545, z);
      rib.rotation.y = side * -0.04;
      tierRoot.add(rib);
    }
  }
}

function createTailplane(side: number, tier: DetailTier) {
  const tail = createPlanform([
    [0, -0.62],
    [side * 1.34, -0.42],
    [side * 2.5, -0.21],
    [side * 2.5, 0.28],
    [side * 1.32, 0.47],
    [0, 0.62],
  ], skin, tier === "low" ? 0.065 : 0.09);
  tail.position.set(0, 0.40, 3.48);
  return tail;
}

function createTailFin(x: number, outer: boolean, tier: DetailTier) {
  const height = outer ? 1.31 : 1.11;
  const fin = createVerticalSurface([
    [-0.62, 0],
    [0.45, 0],
    [0.27, height],
    [-0.08, height * 0.98],
  ], tier === "low" ? 0.065 : 0.085, skin);
  fin.position.set(x, 0.42, 3.52);
  fin.rotation.z = outer ? (x < 0 ? 0.035 : -0.035) : (x < 0 ? 0.02 : -0.02);
  if (tier !== "low") {
    const capHeight = outer ? 0.2 : 0.17;
    const cap = createVerticalSurface([
      [-0.2, height - capHeight],
      [0.31, height - capHeight],
      [0.29, height],
      [-0.17, height],
    ], 0.09, aircraftDarkMaterial);
    fin.add(cap);
  }
  return fin;
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
  const marking = createNationalMarking("us", tier === "ultra" ? 0.3 : 0.25);
  makeDoubleSided(marking);
  marking.position.set(side * 3.72, tier === "ultra" ? 0.082 : 0.067, -0.17);
  marking.rotation.z = side < 0 ? Math.PI : 0;
  wing.add(marking);
}

function createFuselageMarking(side: number, tier: DetailTier) {
  const group = new THREE.Group();
  group.name = `e2c-fuselage-marking:${side < 0 ? "port" : "starboard"}:${tier}`;
  const radius = tier === "ultra" ? 0.29 : 0.24;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, tier === "ultra" ? 28 : 18), markingBlue);
  const star = new THREE.Mesh(createStarGeometry(radius * 0.62), markingWhite);
  star.position.z = 0.008;
  group.add(disc, star);
  for (const barSide of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.95, radius * 0.38, 0.018), markingWhite);
    bar.position.x = barSide * radius * 1.12;
    group.add(bar);
  }
  group.rotation.y = side * Math.PI / 2;
  // Sit on the local fuselage crown instead of hovering ~0.047 model units
  // outside it. A very small clearance avoids z fighting without reading as
  // a detached icon in close side views.
  group.position.set(side * 0.655, 0.03, 1.5);
  return group;
}

function createNacelle(
  tierRoot: THREE.Group,
  side: number,
  tier: DetailTier,
): AewPropellerAnimationHandle {
  const nacelle = new THREE.Group();
  nacelle.name = `e2c-engine:${side < 0 ? "port" : "starboard"}:${tier}`;
  nacelle.position.set(side * 2.26, -0.04, -0.16);
  const nacelleStations: readonly FuselageStation[] = [
    { z: -1.26, radiusX: 0.16, radiusY: 0.15, centerY: 0.01 },
    { z: -1.13, radiusX: 0.31, radiusY: 0.29, centerY: 0.01 },
    { z: -0.86, radiusX: 0.41, radiusY: 0.38, centerY: 0.01 },
    { z: -0.28, radiusX: 0.45, radiusY: 0.42, centerY: 0.01 },
    { z: 0.42, radiusX: 0.41, radiusY: 0.39, centerY: 0.01 },
    { z: 0.89, radiusX: 0.31, radiusY: 0.31, centerY: 0.015 },
    { z: 1.15, radiusX: 0.19, radiusY: 0.2, centerY: 0.02 },
    { z: 1.28, radiusX: 0.06, radiusY: 0.07, centerY: 0.02 },
  ];
  nacelle.add(createLoftedFuselage(
    tier === "low" ? nacelleStations.filter((_, index) => index !== 1 && index !== 4) : nacelleStations,
    skin,
    tierSegments(tier),
  ));
  if (tier !== "low") {
    const intakeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.292, tier === "ultra" ? 0.038 : 0.05, tier === "ultra" ? 10 : 7, tier === "ultra" ? 48 : 24),
      aircraftPanelMaterial,
    );
    intakeRing.position.z = -1.265;
    nacelle.add(intakeRing);
    const intakeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.246, tier === "ultra" ? 32 : 16),
      aircraftDarkMaterial,
    );
    intakeDisc.rotation.y = Math.PI;
    intakeDisc.position.z = -1.277;
    nacelle.add(intakeDisc);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 0.52, tier === "ultra" ? 20 : 12, 1, true), exhaustMaterial);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * -0.31, -0.04, 0.96);
    nacelle.add(exhaust);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.31, 1.18), skin);
    pylon.position.set(0, 0.31, -0.04);
    pylon.rotation.x = side * 0.035;
    nacelle.add(pylon);
    if (tier === "ultra") {
      addPanelLine(nacelle, [0, 0.405, -0.2], [0.31, 0.012, 0.018]);
      const gearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.72), aircraftPanelMaterial);
      gearDoor.position.set(0, -0.4, 0.34);
      nacelle.add(gearDoor);
      for (const z of [-0.78, -0.26, 0.28, 0.7]) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.008, 5, 40), aircraftPanelMaterial);
        seam.scale.y = 0.97;
        seam.position.z = z;
        nacelle.add(seam);
      }
    }
  }
  tierRoot.add(nacelle);

  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0x9faaa8,
    transparent: true,
    opacity: tier === "low" ? 0.11 : tier === "high" ? 0.045 : 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propeller = createAewPropeller({
    radius: PROPELLER_RADIUS,
    hubRadius: tier === "ultra" ? 0.19 : 0.18,
    spinnerLength: 0.4,
    bladeMaterial,
    hubMaterial: aircraftDarkMaterial,
    blurMaterial,
    rotors: [{ direction: 1, bladeCount: 4 }],
    detailed: tier === "ultra",
    blurOnly: tier === "low",
  });
  propeller.object.position.set(side * 2.26, -0.04, -1.58);
  tierRoot.add(propeller.object);
  return propeller;
}

function createRotodome(tierRoot: THREE.Group, tier: DetailTier) {
  const domeCenterY = 1.52;
  const domeCenterZ = 0.12;
  const pylon = createVerticalSurface([
    [-0.52, 0],
    [0.54, 0],
    [0.31, 0.67],
    [-0.2, 0.67],
  ], tier === "low" ? 0.2 : tier === "high" ? 0.25 : 0.29, skin);
  pylon.name = `e2c-rotodome-pylon:${tier}`;
  pylon.position.set(0, 0.66, domeCenterZ);
  tierRoot.add(pylon);
  if (tier === "ultra") {
    for (const side of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.12), skin);
      brace.position.set(side * 0.34, 0.98, domeCenterZ - 0.06);
      brace.rotation.z = side * -0.32;
      tierRoot.add(brace);
    }
    const pylonFairing = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.48, 4, 14),
      aircraftPanelMaterial,
    );
    pylonFairing.rotation.x = Math.PI / 2;
    pylonFairing.scale.set(1.0, 0.7, 1.0);
    pylonFairing.position.set(0, 0.8, domeCenterZ - 0.04);
    tierRoot.add(pylonFairing);
  }

  const rotodome = new THREE.Group();
  rotodome.name = `e2c-rotodome:${tier}`;
  rotodome.position.set(0, domeCenterY, domeCenterZ);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, tier === "ultra" ? 72 : tier === "high" ? 40 : 18, tier === "ultra" ? 24 : tier === "high" ? 14 : 10),
    domeSkin,
  );
  shell.scale.set(ROTODOME_RADIUS, tier === "low" ? 0.15 : 0.18, ROTODOME_RADIUS);
  rotodome.add(shell);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ROTODOME_RADIUS * 0.975, tier === "ultra" ? 0.04 : tier === "high" ? 0.05 : 0.055, tier === "ultra" ? 10 : 7, tier === "ultra" ? 72 : tier === "high" ? 40 : 24),
    aircraftDarkMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  rotodome.add(rim);
  const orientationBand = new THREE.Mesh(
    new THREE.BoxGeometry(ROTODOME_RADIUS * 1.76, 0.035, tier === "ultra" ? 0.075 : 0.1),
    aircraftPanelMaterial,
  );
  orientationBand.position.y = 0.185;
  rotodome.add(orientationBand);
  if (tier !== "low") {
    const undersideBand = new THREE.Mesh(
      new THREE.TorusGeometry(ROTODOME_RADIUS * 0.78, tier === "ultra" ? 0.018 : 0.025, 5, tier === "ultra" ? 56 : 28),
      aircraftPanelMaterial,
    );
    undersideBand.rotation.x = Math.PI / 2;
    undersideBand.position.y = -0.12;
    rotodome.add(undersideBand);
  }
  if (tier === "ultra") {
    for (const z of [-1.05, -0.52, 0, 0.52, 1.05]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.015, 0.22), aircraftPanelMaterial);
      panel.position.set(0, 0.202, z);
      rotodome.add(panel);
    }
  }
  tierRoot.add(rotodome);
  return rotodome;
}

function buildTier(root: THREE.Group, tierRoot: THREE.Group, tier: DetailTier) {
  tierRoot.name = `e2c:${tier}`;
  tierRoot.add(createLoftedFuselage(
    tier === "low" ? LOW_FUSELAGE_STATIONS : FUSELAGE_STATIONS,
    skin,
    tierSegments(tier),
  ));
  addCockpit(tierRoot, tier);
  for (const side of [-1, 1]) {
    const wing = createWing(side, tier);
    addWingMarking(wing, side, tier);
    tierRoot.add(wing, createTailplane(side, tier));
    addWingSurfaceDetail(tierRoot, side, tier);
    addNavigationLight(root, tierRoot, side, [side * HALF_SPAN, 0.49, -0.35], tier === "low" ? 0.075 : 0.06);
  }
  for (const side of [-1, 1]) {
    tierRoot.add(
      createTailFin(side * 0.7, false, tier),
      createTailFin(side * 1.72, true, tier),
    );
  }
  if (tier !== "low") {
    tierRoot.add(createFuselageMarking(-1, tier), createFuselageMarking(1, tier));
    const wingBox = createPlanform([
      [-1.92, -0.96],
      [1.92, -0.96],
      [1.98, 0.66],
      [1.46, 0.86],
      [-1.46, 0.86],
      [-1.98, 0.66],
    ], skin, tier === "ultra" ? 0.2 : 0.16);
    wingBox.position.set(0, 0.48, -0.04);
    tierRoot.add(wingBox);
    const ventralRadar = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, tier === "ultra" ? 24 : 14, tier === "ultra" ? 12 : 8),
      aircraftPanelMaterial,
    );
    ventralRadar.scale.set(1.0, 0.42, 1.3);
    ventralRadar.position.set(0, -0.68, -2.48);
    tierRoot.add(ventralRadar);
  }
  if (tier === "ultra") {
    [-2.35, -0.4, 1.92, 3.25].forEach((z) => {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.665, 0.008, 4, 30), aircraftPanelMaterial);
      seam.scale.y = 0.97;
      seam.position.z = z;
      tierRoot.add(seam);
    });
    const dorsalAntenna = createVerticalSurface([[-0.16, 0], [0.19, 0], [0.08, 0.32], [-0.04, 0.32]], 0.045, whitePaint);
    dorsalAntenna.position.set(0, 0.66, 2.2);
    tierRoot.add(dorsalAntenna);
    for (const [z, height] of [[-2.65, 0.22], [1.58, 0.2], [2.78, 0.24]] as const) {
      const blade = createVerticalSurface(
        [[-0.12, 0], [0.15, 0], [0.06, height], [-0.035, height]],
        0.035,
        whitePaint,
      );
      blade.position.set(0, 0.65, z);
      tierRoot.add(blade);
    }
    for (const side of [-1, 1]) {
      const sponson = createLoftedFuselage([
        { z: -0.34, radiusX: 0.08, radiusY: 0.055 },
        { z: 0, radiusX: 0.13, radiusY: 0.085 },
        { z: 0.42, radiusX: 0.055, radiusY: 0.04 },
      ], aircraftPanelMaterial, 28);
      sponson.position.set(side * 0.72, -0.12, 2.12);
      tierRoot.add(sponson);
    }
  }
  const props = [createNacelle(tierRoot, -1, tier), createNacelle(tierRoot, 1, tier)];
  const rotodome = createRotodome(tierRoot, tier);
  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(tier === "low" ? 0.07 : 0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8f2ef }),
  );
  // The horizontal tail ends near z=4.10; the former z=4.34 location floated
  // above the narrow tail cone with no supporting surface.
  tailLight.position.set(0, 0.46, 4.02);
  tierRoot.add(tailLight);
  return { props, rotodome };
}

export function createE2cModel() {
  const root = new THREE.Group();
  root.name = "E-2C Hawkeye / NTU-era asset";
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
  root.userData.modelVariant = "E-2C / AN/APS-125 era / four-blade propellers";
  root.userData.referenceDimensions = DIMENSIONS;
  root.userData.propellerBladeCount = 4;
  root.userData.rotorSetsPerEngine = 1;
  const finished = finishAircraftModel(root, tiers, {
    length: DIMENSIONS.modelLength,
    realLengthMeters: DIMENSIONS.realLengthMeters,
    realWingspanMeters: DIMENSIONS.realWingspanMeters,
    engines: [],
    lodNear: 105,
    lodMedium: 260,
    detailTags: [
      "quality-aware-ultra-high-low",
      "ntu-four-blade-t56",
      "high-mounted-folding-wing",
      "four-fin-tail",
      "7.315m-lenticular-rotodome",
      "segmented-cockpit-glazing",
      "carrier-aew",
    ],
  });
  return finished;
}
