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

const FUSELAGE_STATIONS: readonly FuselageStation[] = [
  { z: -4.4, radiusX: 0.06, radiusY: 0.05, centerY: -0.08 },
  { z: -4.18, radiusX: 0.34, radiusY: 0.3, centerY: -0.06 },
  { z: -3.78, radiusX: 0.58, radiusY: 0.48, centerY: -0.01 },
  { z: -3.18, radiusX: 0.68, radiusY: 0.62, centerY: 0.03 },
  { z: -2.35, radiusX: 0.7, radiusY: 0.68, centerY: 0.02 },
  { z: 0.4, radiusX: 0.68, radiusY: 0.69 },
  { z: 2.35, radiusX: 0.61, radiusY: 0.63, centerY: 0.02 },
  { z: 3.35, radiusX: 0.42, radiusY: 0.47, centerY: 0.04 },
  { z: 4.05, radiusX: 0.23, radiusY: 0.27, centerY: 0.04 },
  { z: 4.4, radiusX: 0.055, radiusY: 0.055, centerY: 0.03 },
] as const;

const LOW_FUSELAGE_STATIONS = FUSELAGE_STATIONS.filter((_, index) => index === 0 || index === 2 || index === 4 || index === 6 || index === 8 || index === 9);

function tierSegments(tier: DetailTier) {
  return tier === "ultra" ? 30 : tier === "high" ? 18 : 10;
}

function addCockpit(tierRoot: THREE.Group, tier: DetailTier) {
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
  tierRoot.add(panes);
}

function createWing(side: number, tier: DetailTier) {
  const wing = createPlanform([
    [0, -1.34],
    [side * 2.55, -1.18],
    [side * HALF_SPAN, -0.78],
    [side * HALF_SPAN, -0.15],
    [side * 2.55, 0.62],
    [0, 1.03],
  ], skin, tier === "low" ? 0.075 : tier === "high" ? 0.105 : 0.135);
  wing.position.y = 0.42;
  wing.rotation.z = side * 0.012;
  return wing;
}

function createTailplane(side: number, tier: DetailTier) {
  const tail = createPlanform([
    [0, -0.62],
    [side * 2.5, -0.24],
    [side * 2.5, 0.25],
    [0, 0.61],
  ], skin, tier === "low" ? 0.065 : 0.09);
  tail.position.set(0, 0.39, 3.48);
  return tail;
}

function createTailFin(x: number, outer: boolean, tier: DetailTier) {
  const height = outer ? 1.32 : 1.14;
  const fin = createVerticalSurface([
    [-0.54, 0],
    [0.48, 0],
    [0.29, height],
    [-0.17, height],
  ], tier === "low" ? 0.065 : 0.085, skin);
  fin.position.set(x, 0.42, 3.48);
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
  group.position.set(side * 0.694, 0.03, 1.5);
  return group;
}

function createNacelle(
  tierRoot: THREE.Group,
  side: number,
  tier: DetailTier,
): AewPropellerAnimationHandle {
  const nacelle = new THREE.Group();
  nacelle.name = `e2c-engine:${side < 0 ? "port" : "starboard"}:${tier}`;
  nacelle.position.set(side * 2.26, -0.01, -0.18);
  const nacelleStations: readonly FuselageStation[] = [
    { z: -1.2, radiusX: 0.22, radiusY: 0.2 },
    { z: -0.94, radiusX: 0.39, radiusY: 0.36 },
    { z: -0.36, radiusX: 0.44, radiusY: 0.41 },
    { z: 0.48, radiusX: 0.39, radiusY: 0.37 },
    { z: 1.02, radiusX: 0.25, radiusY: 0.27 },
    { z: 1.24, radiusX: 0.09, radiusY: 0.11 },
  ];
  nacelle.add(createLoftedFuselage(
    tier === "low" ? nacelleStations.filter((_, index) => index !== 1 && index !== 4) : nacelleStations,
    skin,
    tierSegments(tier),
  ));
  if (tier !== "low") {
    const intakeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, tier === "ultra" ? 0.045 : 0.055, 6, tier === "ultra" ? 24 : 14),
      aircraftPanelMaterial,
    );
    intakeRing.position.z = -1.205;
    nacelle.add(intakeRing);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.48, 10, 1, true), exhaustMaterial);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * -0.31, -0.05, 0.83);
    nacelle.add(exhaust);
    if (tier === "ultra") {
      addPanelLine(nacelle, [0, 0.405, -0.2], [0.31, 0.012, 0.018]);
      const gearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.72), aircraftPanelMaterial);
      gearDoor.position.set(0, -0.39, 0.28);
      nacelle.add(gearDoor);
    }
  }
  tierRoot.add(nacelle);

  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0x9faaa8,
    transparent: true,
    opacity: tier === "low" ? 0.11 : tier === "high" ? 0.05 : 0.025,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propeller = createAewPropeller({
    radius: PROPELLER_RADIUS,
    hubRadius: 0.18,
    spinnerLength: 0.36,
    bladeMaterial,
    hubMaterial: aircraftDarkMaterial,
    blurMaterial,
    rotors: [{ direction: 1, bladeCount: 4 }],
    detailed: tier === "ultra",
    blurOnly: tier === "low",
  });
  propeller.object.position.set(side * 2.26, -0.01, -1.55);
  tierRoot.add(propeller.object);
  return propeller;
}

function createRotodome(tierRoot: THREE.Group, tier: DetailTier) {
  const domeCenterY = 1.52;
  const domeCenterZ = 0.12;
  const pylon = createVerticalSurface([
    [-0.46, 0],
    [0.48, 0],
    [0.27, 0.67],
    [-0.16, 0.67],
  ], tier === "low" ? 0.2 : 0.25, skin);
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
  }

  const rotodome = new THREE.Group();
  rotodome.name = `e2c-rotodome:${tier}`;
  rotodome.position.set(0, domeCenterY, domeCenterZ);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, tier === "ultra" ? 48 : tier === "high" ? 28 : 16, tier === "ultra" ? 16 : 10),
    domeSkin,
  );
  shell.scale.set(ROTODOME_RADIUS, tier === "low" ? 0.15 : 0.18, ROTODOME_RADIUS);
  rotodome.add(shell);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ROTODOME_RADIUS * 0.975, tier === "ultra" ? 0.045 : 0.055, 7, tier === "ultra" ? 48 : 24),
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
    const wingBox = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.18, 1.55), skin);
    wingBox.position.set(0, 0.42, -0.12);
    tierRoot.add(wingBox);
    for (const side of [-1, 1]) {
      const foldLine = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 1.34), aircraftPanelMaterial);
      foldLine.position.set(side * 3.62, 0.505, -0.24);
      foldLine.rotation.y = side * -0.055;
      tierRoot.add(foldLine);
    }
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
  }
  const props = [createNacelle(tierRoot, -1, tier), createNacelle(tierRoot, 1, tier)];
  const rotodome = createRotodome(tierRoot, tier);
  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(tier === "low" ? 0.07 : 0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8f2ef }),
  );
  tailLight.position.set(0, 0.48, 4.34);
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
  finished.userData.modelAssetVersion = "v1.1-ultra";
  return finished;
}
