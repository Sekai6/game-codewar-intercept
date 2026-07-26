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
  { z: -13.1, radiusX: 0.56, radiusY: 0.54, centerY: -0.03 },
  { z: -12.25, radiusX: 0.92, radiusY: 0.9, centerY: 0.02 },
  { z: -10.8, radiusX: 1.04, radiusY: 1.02, centerY: 0.03 },
  { z: -7.4, radiusX: 1.06, radiusY: 1.06, centerY: 0.02 },
  { z: -2.2, radiusX: 1.07, radiusY: 1.08 },
  { z: 4.5, radiusX: 1.05, radiusY: 1.06 },
  { z: 8.2, radiusX: 0.93, radiusY: 0.96, centerY: 0.03 },
  { z: 10.65, radiusX: 0.69, radiusY: 0.74, centerY: 0.07 },
  { z: 12.35, radiusX: 0.42, radiusY: 0.47, centerY: 0.08 },
  { z: HALF_AIRFRAME, radiusX: 0.07, radiusY: 0.08, centerY: 0.06 },
] as const;

const LOW_FUSELAGE_STATIONS = FUSELAGE_STATIONS.filter((_, index) => index === 0 || index === 2 || index === 4 || index === 6 || index === 8 || index === 9 || index === 10);

function tierSegments(tier: DetailTier) {
  return tier === "ultra" ? 32 : tier === "high" ? 18 : 10;
}

function createWing(side: number, tier: DetailTier) {
  const wing = createPlanform([
    [0, -4.72],
    [side * 4.5, -3.32],
    [side * HALF_SPAN, 1.72],
    [side * HALF_SPAN, 3.7],
    [side * 4.5, 2.78],
    [0, 2.94],
  ], skin, tier === "low" ? 0.14 : tier === "high" ? 0.2 : 0.27);
  wing.position.y = -0.04;
  wing.rotation.z = -side * 0.024;
  return wing;
}

function createTailplane(side: number, tier: DetailTier) {
  const tail = createPlanform([
    [0, -1.45],
    [side * 4.55, 0.62],
    [side * 4.55, 1.42],
    [0, 1.18],
  ], skin, tier === "low" ? 0.11 : 0.17);
  tail.position.set(0, 0.92, 10.68);
  return tail;
}

function addCockpitGlazing(tierRoot: THREE.Group, tier: DetailTier) {
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
  }
  tierRoot.add(cockpit);
}

function addCabinWindows(tierRoot: THREE.Group, tier: DetailTier) {
  if (tier === "low") return;
  const positions = tier === "ultra"
    ? [-9.6, -8.4, -7.2, -5.9, -4.6, -3.3, -2.0, -0.6, 0.8, 2.2, 3.6, 5.0]
    : [-8.8, -6.2, -3.6, -1.0, 1.6, 4.2];
  const geometry = new THREE.SphereGeometry(0.1, tier === "ultra" ? 10 : 7, 6);
  const windows = new THREE.InstancedMesh(geometry, aircraftGlassMaterial, positions.length * 2);
  windows.name = `tu126-cabin-windows:${tier}`;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const side of [-1, 1]) for (const z of positions) {
    matrix.compose(
      new THREE.Vector3(side * 1.055, 0.24, z),
      new THREE.Quaternion(),
      new THREE.Vector3(0.16, 0.82, 1.08),
    );
    windows.setMatrixAt(index++, matrix);
  }
  windows.instanceMatrix.needsUpdate = true;
  windows.computeBoundingBox();
  windows.computeBoundingSphere();
  tierRoot.add(windows);
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
  group.position.set(side * 0.13, 4.15, 11.25);
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
  nacelle.position.set(x, -0.36, z);
  const nacelleStations: readonly FuselageStation[] = [
    { z: -3.02, radiusX: 0.34, radiusY: 0.32 },
    { z: -2.6, radiusX: 0.63, radiusY: 0.61 },
    { z: -1.6, radiusX: 0.72, radiusY: 0.69 },
    { z: 0.65, radiusX: 0.67, radiusY: 0.64 },
    { z: 1.82, radiusX: 0.48, radiusY: 0.49 },
    { z: 2.55, radiusX: 0.18, radiusY: 0.2 },
  ];
  nacelle.add(createLoftedFuselage(
    tier === "low" ? nacelleStations.filter((_, index) => index !== 1 && index !== 4) : nacelleStations,
    lowerSkin,
    tierSegments(tier),
  ));
  if (inner) {
    const gearFairingStations: readonly FuselageStation[] = [
      { z: 0.35, radiusX: 0.39, radiusY: 0.34, centerY: -0.18 },
      { z: 1.8, radiusX: 0.49, radiusY: 0.43, centerY: -0.2 },
      { z: 3.55, radiusX: 0.42, radiusY: 0.38, centerY: -0.18 },
      { z: 4.65, radiusX: 0.09, radiusY: 0.1, centerY: -0.08 },
    ];
    nacelle.add(createLoftedFuselage(gearFairingStations, lowerSkin, tierSegments(tier)));
  }
  if (tier !== "low") {
    const intakeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, tier === "ultra" ? 0.065 : 0.08, 7, tier === "ultra" ? 28 : 16),
      aircraftPanelMaterial,
    );
    intakeRing.position.z = -3.03;
    nacelle.add(intakeRing);
    for (const exhaustSide of [-1, 1]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.72, 10, 1, true), exhaustMaterial);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(exhaustSide * 0.5, -0.02, 1.18);
      nacelle.add(exhaust);
    }
    if (tier === "ultra") {
      addPanelLine(nacelle, [0, 0.66, -1.35], [0.46, 0.014, 0.025]);
      const gearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, inner ? 2.25 : 0.9), aircraftPanelMaterial);
      gearDoor.position.set(0, -0.68, inner ? 1.55 : 0.45);
      nacelle.add(gearDoor);
    }
  }

  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0xa4aeab,
    transparent: true,
    opacity: tier === "low" ? 0.12 : tier === "high" ? 0.055 : 0.027,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propeller = createAewPropeller({
    radius: PROPELLER_RADIUS,
    hubRadius: 0.31,
    spinnerLength: 0.68,
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
  propeller.object.position.z = -3.25;
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
  ], tier === "low" ? 0.46 : 0.62, skin);
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
  }

  const rotodome = new THREE.Group();
  rotodome.name = `tu126-liana-rotodome:${tier}`;
  rotodome.position.set(
    0,
    pylonBaseY + DIMENSIONS.modelRotodomeSupportHeight + DIMENSIONS.modelRotodomeThickness * 0.5,
    pylonZ,
  );
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, tier === "ultra" ? 56 : tier === "high" ? 32 : 18, tier === "ultra" ? 20 : 10),
    domeSkin,
  );
  shell.scale.set(ROTODOME_RADIUS, DIMENSIONS.modelRotodomeThickness * 0.5, ROTODOME_RADIUS);
  rotodome.add(shell);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ROTODOME_RADIUS * 0.974, tier === "ultra" ? 0.075 : 0.095, 8, tier === "ultra" ? 56 : 28),
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
    addNavigationLight(root, tierRoot, side, [side * HALF_SPAN, -0.31, 2.58], tier === "low" ? 0.11 : 0.085);
  }

  const fin = createVerticalSurface([
    [-2.34, 0],
    [2.68, 0],
    [2.02, 5.27],
    [0.34, 5.27],
  ], tier === "low" ? 0.17 : 0.22, skin);
  fin.position.set(0, 0.72, 10.55);
  tierRoot.add(fin);
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
      new THREE.SphereGeometry(0.5, tier === "ultra" ? 18 : 12, tier === "ultra" ? 10 : 7),
      aircraftPanelMaterial,
    );
    tailEcmFairing.scale.set(0.42, 0.38, 1.35);
    tailEcmFairing.position.set(0, 0.05, 12.72);
    tierRoot.add(tailEcmFairing);
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
