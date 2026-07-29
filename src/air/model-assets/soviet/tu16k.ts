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

const dimensions = AIRCRAFT_REFERENCE_DIMENSIONS.TU16K;
const length = dimensions.modelLength;
const halfLength = length * 0.5;
const halfSpan = dimensions.modelWingspan * 0.5;
const WING_SWEEP_DEG = 35;
const MAIN_WING_CENTER_Y = 0.15;
const KSR_CARRIER_BEAM_BOTTOM_Y = -0.62;
const KSR_CARRIER_BRACE_OVERLAP = 0.02;
const KSR_WEAPON_CONTACT_OVERLAP = 0.008;

const aluminumPaint = aircraftPaint(0xa5aaa6, 0.43, 0.19);
const palePanelPaint = aircraftPaint(0xb5b9b4, 0.5, 0.12);
const undersidePaint = aircraftPaint(0x929995, 0.54, 0.12);
const nacellePaint = aircraftPaint(0x858d89, 0.4, 0.2);
const hotSectionPaint = aircraftPaint(0x505754, 0.34, 0.22);
const radomePaint = aircraftPaint(0x4c5754, 0.66, 0.09);
const lowGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x19333c,
  metalness: 0.12,
  roughness: 0.34,
});
const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x272c2b,
  metalness: 0.72,
  roughness: 0.29,
});

export const TU16K_MODEL_STATIONS = [
  // The KSR-5 carrier sits just outboard of each engine, with the missile
  // centre under the wing mid-chord (the nose projects ahead of the leading
  // edge while the aft fins remain behind the trailing edge).
  { id: "wing-port-ksr", position: [-3.55, -1.35, 0.02] as Vec3Tuple },
  { id: "wing-starboard-ksr", position: [3.55, -1.35, 0.02] as Vec3Tuple },
] as const;

function glazedNoseStations(): readonly FuselageStation[] {
  return [
    { z: -halfLength, radiusX: 0.018, radiusY: 0.014, centerY: -0.12 },
    { z: -8.35, radiusX: 0.26, radiusY: 0.22, centerY: -0.1 },
    { z: -7.96, radiusX: 0.46, radiusY: 0.39, centerY: -0.075 },
    { z: -7.52, radiusX: 0.61, radiusY: 0.51, centerY: -0.03 },
    { z: -7.12, radiusX: 0.7, radiusY: 0.59, centerY: 0.015 },
  ];
}

function mainFuselageStations(): readonly FuselageStation[] {
  return [
    { z: -7.12, radiusX: 0.7, radiusY: 0.59, centerY: 0.015 },
    { z: -6.62, radiusX: 0.76, radiusY: 0.68, centerY: 0.045 },
    { z: -5.78, radiusX: 0.79, radiusY: 0.72, centerY: 0.04 },
    { z: -4.45, radiusX: 0.8, radiusY: 0.73, centerY: 0.025 },
    { z: -2.3, radiusX: 0.81, radiusY: 0.74, centerY: 0.015 },
    { z: 0, radiusX: 0.81, radiusY: 0.74, centerY: 0 },
    { z: 2.35, radiusX: 0.78, radiusY: 0.71, centerY: 0.015 },
    { z: 4.25, radiusX: 0.72, radiusY: 0.66, centerY: 0.025 },
    { z: 5.75, radiusX: 0.61, radiusY: 0.56, centerY: 0.035 },
    { z: 6.9, radiusX: 0.47, radiusY: 0.45, centerY: 0.04 },
    { z: 7.78, radiusX: 0.29, radiusY: 0.3, centerY: 0.035 },
    { z: 8.22, radiusX: 0.18, radiusY: 0.19, centerY: 0.025 },
  ];
}

function nacelleStations(): readonly FuselageStation[] {
  return [
    { z: -3.05, radiusX: 0.49, radiusY: 0.43, centerY: -0.08 },
    { z: -2.72, radiusX: 0.64, radiusY: 0.54, centerY: -0.075 },
    { z: -2.05, radiusX: 0.71, radiusY: 0.59, centerY: -0.06 },
    { z: -0.8, radiusX: 0.73, radiusY: 0.61, centerY: -0.04 },
    { z: 0.75, radiusX: 0.7, radiusY: 0.59, centerY: -0.035 },
    { z: 2.25, radiusX: 0.64, radiusY: 0.55, centerY: -0.025 },
    { z: 3.55, radiusX: 0.56, radiusY: 0.49, centerY: -0.015 },
    { z: 4.32, radiusX: 0.49, radiusY: 0.43, centerY: -0.005 },
  ];
}

function tierSegments(tier: DetailTier) {
  // The Badger's long cylindrical body and nacelles need denser radial
  // sampling at Ultra to avoid faceting in close side/bottom views.  High and
  // Low remain separate, materially lighter meshes.
  return tier === "ultra" ? 144 : tier === "high" ? 80 : 18;
}

function mainWingThickness(tier: DetailTier) {
  return tier === "ultra" ? 0.19 : tier === "high" ? 0.135 : 0.085;
}

function mainWingUndersideY(tier: DetailTier) {
  return MAIN_WING_CENTER_Y - mainWingThickness(tier) * 0.5;
}

function addGlazedNose(parent: THREE.Group, tier: DetailTier) {
  const segments = tierSegments(tier);
  const material = tier === "low" ? lowGlassMaterial : aircraftGlassMaterial;
  const nose = createLoftedFuselage(glazedNoseStations(), material, segments);
  nose.name = `tu16-faceted-glazed-nose:${tier}`;
  parent.add(nose);
  if (tier === "low") return;
  const longitudinalFrames = tier === "ultra" ? [-0.39, -0.26, -0.13, 0, 0.13, 0.26, 0.39] : [-0.3, -0.15, 0, 0.15, 0.3];
  for (const x of longitudinalFrames) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(tier === "ultra" ? 0.012 : 0.016, 0.022, 1.1), aircraftPanelMaterial);
    frame.position.set(x, -0.035 + Math.abs(x) * 0.22, -7.63);
    frame.rotation.y = x * -0.15;
    parent.add(frame);
  }
  const lowerCrossFrame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.018, 0.025), aircraftPanelMaterial);
  lowerCrossFrame.position.set(0, -0.28, -7.58);
  parent.add(lowerCrossFrame);
  if (tier === "ultra") {
    const upperCrossFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.018, 0.025), aircraftPanelMaterial);
    upperCrossFrame.position.set(0, 0.2, -7.46);
    parent.add(upperCrossFrame);
  }
}

function addCockpitWindows(parent: THREE.Group, tier: DetailTier) {
  const material = tier === "low" ? lowGlassMaterial : aircraftGlassMaterial;
  for (const side of [-1, 1]) {
    const windscreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.25, tier === "ultra" ? 0.045 : 0.07),
      material,
    );
    windscreen.position.set(side * 0.25, 0.66, -6.63);
    windscreen.rotation.y = side * 0.26;
    windscreen.rotation.x = -0.18;
    parent.add(windscreen);
    const sideWindow = new THREE.Mesh(
      new THREE.BoxGeometry(tier === "ultra" ? 0.045 : 0.07, 0.28, 0.42),
      material,
    );
    sideWindow.position.set(side * 0.62, 0.58, -6.38);
    sideWindow.rotation.y = side * -0.12;
    parent.add(sideWindow);
  }
  if (tier !== "low") {
    const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.06), aircraftPanelMaterial);
    centerPost.position.set(0, 0.66, -6.67);
    centerPost.rotation.x = -0.18;
    parent.add(centerPost);
    const cockpitRoof = createPlanform([
      [-0.54, -6.76],
      [-0.48, -6.08],
      [0.48, -6.08],
      [0.54, -6.76],
    ], palePanelPaint, 0.08);
    cockpitRoof.position.y = 0.71;
    parent.add(cockpitRoof);
    if (tier === "ultra") {
      const roofSeam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.018, 0.028), aircraftSeamMaterial);
      roofSeam.position.set(0, 0.756, -6.42);
      roofSeam.rotation.y = Math.PI * 0.5;
      parent.add(roofSeam);
    }
  }
}

function addMainWing(parent: THREE.Group, tier: DetailTier, surfaceMarkings: THREE.Object3D[]) {
  const thickness = mainWingThickness(tier);
  const rootX = 0.63;
  const rootLeadingZ = -2.55;
  const tipLeadingZ = rootLeadingZ
    + Math.tan(THREE.MathUtils.degToRad(WING_SWEEP_DEG)) * (halfSpan - rootX);
  for (const side of [-1, 1]) {
    const wing = createPlanform([
      [side * rootX, rootLeadingZ],
      [side * halfSpan, tipLeadingZ],
      [side * halfSpan, tipLeadingZ + 1.03],
      [side * 0.68, 2.35],
    ], tier === "low" ? undersidePaint : aluminumPaint, thickness);
    wing.name = `tu16-strongly-swept-wing:${side < 0 ? "port" : "starboard"}:${tier}`;
    wing.position.y = 0.15;
    parent.add(wing);
    const rootFairing = createPlanform([
      [side * 1.27, -2.72],
      [side * 2.72, -2.39],
      [side * 2.74, 3.36],
      [side * 1.33, 2.73],
    ], tier === "low" ? undersidePaint : aluminumPaint, thickness * 1.3);
    rootFairing.position.y = 0.07;
    rootFairing.name = `tu16-wing-root-engine-blend:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(rootFairing);
    if (tier !== "low") {
      const marking = createNationalMarking("ussr", tier === "ultra" ? 0.34 : 0.29);
      marking.position.set(side * 5.2, 0.15 + thickness * 0.56, 1.4);
      parent.add(marking);
      surfaceMarkings.push(marking);
    }
    if (tier === "ultra") {
      addPanelLine(parent, [side * 3.05, 0.15 + thickness * 0.57, 0.55], [2.2, 0.012, 0.026], [0, side * 0.47, 0]);
      addPanelLine(parent, [side * 5.95, 0.15 + thickness * 0.57, 2.75], [1.25, 0.012, 0.025], [0, side * 0.37, 0]);
      for (const z of [1.05, 1.72, 2.36]) {
        const flapLine = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.012, 0.025), aircraftSeamMaterial);
        flapLine.position.set(side * 4.45, 0.15 + thickness * 0.58, z);
        flapLine.rotation.y = side * 0.14;
        parent.add(flapLine);
      }
    }
  }
}

function addEngineNacelle(parent: THREE.Group, side: number, tier: DetailTier) {
  const segments = tierSegments(tier);
  const nacelle = createLoftedFuselage(nacelleStations(), tier === "low" ? undersidePaint : nacellePaint, segments);
  nacelle.name = `tu16-integrated-wing-root-nacelle:${side < 0 ? "port" : "starboard"}:${tier}`;
  nacelle.position.set(side * 2.05, 0.03, 0);
  parent.add(nacelle);
  const intakeGroup = new THREE.Group();
  intakeGroup.position.set(side * 2.05, -0.04, -3.02);
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.46, 0.13, tier === "ultra" ? 24 : tier === "high" ? 16 : 10),
    aircraftDarkMaterial,
  );
  throat.rotation.x = Math.PI / 2;
  throat.scale.x = 1.2;
  throat.scale.z = 0.88;
  intakeGroup.add(throat);
  if (tier !== "low") {
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, tier === "ultra" ? 0.075 : 0.1, 7, tier === "ultra" ? 30 : 18),
      palePanelPaint,
    );
    lip.scale.set(1.18, 0.9, 1);
    intakeGroup.add(lip);
    if (tier === "ultra") {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.79, 0.09), aircraftPanelMaterial);
      divider.position.z = -0.035;
      intakeGroup.add(divider);
      const spinner = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 24), hotSectionPaint);
      spinner.rotation.x = Math.PI / 2;
      spinner.position.z = 0.04;
      intakeGroup.add(spinner);
      for (let index = 0; index < 10; index++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.28, 0.014), hotSectionPaint);
        blade.position.z = 0.025;
        blade.rotation.z = index / 10 * Math.PI * 2;
        intakeGroup.add(blade);
      }
    }
  }
  parent.add(intakeGroup);
  const nozzle = createNozzle(0.48, 0.62, tier === "ultra" ? 32 : tier === "high" ? 18 : 10, tier === "ultra");
  nozzle.position.set(side * 2.05, 0.03, 4.35);
  parent.add(nozzle);
  if (tier !== "low") {
    const seamZ = tier === "ultra" ? [-2.3, -1.05, 0.55, 2.05, 3.28] : [-1.8, 0.6, 2.65];
    for (const z of seamZ) {
      const seam = new THREE.Mesh(
        new THREE.TorusGeometry(0.705, tier === "ultra" ? 0.008 : 0.012, 5, tier === "ultra" ? 24 : 14),
        aircraftSeamMaterial,
      );
      seam.scale.y = 0.86;
      seam.position.set(side * 2.05, 0.03, z);
      parent.add(seam);
    }
  }
  if (tier === "ultra") {
    const hotFairing = createPlanform([
      [side * 1.48, 2.88],
      [side * 2.62, 2.92],
      [side * 2.52, 4.48],
      [side * 1.58, 4.35],
    ], hotSectionPaint, 0.17);
    hotFairing.position.y = 0.03;
    parent.add(hotFairing);
  }
}

function addTailSurfaces(parent: THREE.Group, tier: DetailTier) {
  const thickness = tier === "ultra" ? 0.13 : tier === "high" ? 0.09 : 0.065;
  const dorsalFillet = createVerticalSurface([
    [-2.75, 0],
    [-0.3, 1.04],
    [1.0, 0.98],
    [1.48, 0],
  ], thickness * 0.88, tier === "low" ? undersidePaint : aluminumPaint);
  dorsalFillet.position.set(0, 0.5, 5.38);
  parent.add(dorsalFillet);
  const fin = createVerticalSurface([
    [-1.35, 0],
    [0.3, 3.5],
    [0.92, 3.4],
    [1.48, 0],
  ], thickness, tier === "low" ? undersidePaint : aluminumPaint);
  fin.name = `tu16-large-swept-fin:${tier}`;
  fin.position.set(0, 0.5, 6.25);
  parent.add(fin);
  const finCap = createVerticalSurface([
    [0.2, 3.29],
    [0.3, 3.5],
    [0.92, 3.4],
    [0.84, 3.2],
  ], thickness * 1.03, radomePaint);
  finCap.position.copy(fin.position);
  if (tier !== "low") parent.add(finCap);
  if (tier === "ultra") {
    const rudderSeam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.95, 0.028), aircraftSeamMaterial);
    rudderSeam.position.set(0, 1.54, 6.37);
    rudderSeam.rotation.z = -0.06;
    parent.add(rudderSeam);
  }
  for (const side of [-1, 1]) {
    const tailplane = createPlanform([
      [side * 0.48, 5.55],
      [side * 3.1, 7.08],
      [side * 2.92, 7.76],
      [side * 0.5, 7.08],
    ], tier === "low" ? undersidePaint : aluminumPaint, thickness * 0.72);
    tailplane.position.y = 0.28;
    tailplane.name = `tu16-swept-tailplane:${side < 0 ? "port" : "starboard"}:${tier}`;
    parent.add(tailplane);
  }
}

function addTailTurret(parent: THREE.Group, tier: DetailTier) {
  const segments = tier === "ultra" ? 48 : tier === "high" ? 24 : 10;
  const fairing = createLoftedFuselage([
    { z: 7.68, radiusX: 0.25, radiusY: 0.25, centerY: 0.035 },
    { z: 8.04, radiusX: 0.3, radiusY: 0.27, centerY: 0.025 },
    { z: 8.34, radiusX: 0.24, radiusY: 0.21, centerY: 0.005 },
    { z: 8.55, radiusX: 0.13, radiusY: 0.12, centerY: -0.005 },
    { z: halfLength - 0.22, radiusX: 0.055, radiusY: 0.05, centerY: -0.01 },
  ], tier === "low" ? undersidePaint : nacellePaint, segments);
  fairing.name = `tu16-tail-gun-turret:${tier}`;
  parent.add(fairing);
  const barrelCount = tier === "low" ? 1 : 2;
  const barrelLength = tier === "ultra" ? 0.36 : tier === "high" ? 0.3 : 0.22;
  for (let index = 0; index < barrelCount; index++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(
        tier === "low" ? 0.022 : 0.015,
        tier === "low" ? 0.028 : 0.021,
        barrelLength,
        tier === "ultra" ? 12 : 6,
      ),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(
      barrelCount === 1 ? 0 : (index ? 0.07 : -0.07),
      tier === "low" ? 0.005 : -0.025,
      halfLength - barrelLength * 0.5,
    );
    parent.add(barrel);
  }
  if (tier === "ultra") {
    const sight = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 7), lowGlassMaterial);
    sight.scale.set(1, 0.7, 0.65);
    sight.position.set(0, 0.2, 8.2);
    parent.add(sight);
  }
}

function addVentralRadar(parent: THREE.Group, tier: DetailTier) {
  const radar = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, tier === "ultra" ? 36 : tier === "high" ? 22 : 10, tier === "ultra" ? 20 : 10),
    radomePaint,
  );
  radar.scale.set(0.96, 0.38, 1.42);
  radar.position.set(0, -0.69, -3.22);
  radar.rotation.x = -0.08;
  radar.name = `tu16-ventral-rubin-radar:${tier}`;
  parent.add(radar);
  if (tier === "ultra") {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.43, 0.12, 20), aircraftPanelMaterial);
    collar.position.set(0, -0.57, -3.2);
    collar.scale.z = 1.22;
    parent.add(collar);
  }
}

function addStaticAirframe(parent: THREE.Group, tier: DetailTier, surfaceMarkings: THREE.Object3D[]) {
  const segments = tierSegments(tier);
  addGlazedNose(parent, tier);
  const fuselage = createLoftedFuselage(mainFuselageStations(), tier === "low" ? undersidePaint : aluminumPaint, segments);
  fuselage.name = `tu16-long-lofted-fuselage:${tier}`;
  parent.add(fuselage);
  addCockpitWindows(parent, tier);
  addMainWing(parent, tier, surfaceMarkings);
  for (const side of [-1, 1]) addEngineNacelle(parent, side, tier);
  addTailSurfaces(parent, tier);
  addTailTurret(parent, tier);
  addVentralRadar(parent, tier);
  if (tier !== "low") {
    const noseCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.695, tier === "ultra" ? 0.006 : 0.009, 4, tier === "ultra" ? 34 : 20),
      aircraftPanelMaterial,
    );
    noseCollar.scale.y = 0.84;
    noseCollar.position.set(0, 0.015, -7.12);
    parent.add(noseCollar);
  }
  if (tier === "ultra") {
    for (const z of [-5.25, -3.65, -1.2, 1.15, 3.35, 5.15]) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.795, 0.009, 4, 32), aircraftSeamMaterial);
      seam.scale.y = 0.91;
      seam.position.set(0, 0.01, z);
      parent.add(seam);
    }
    const dorsalAerial = createVerticalSurface([
      [-0.22, 0],
      [0.01, 0.31],
      [0.24, 0],
    ], 0.04, radomePaint);
    dorsalAerial.position.set(0, 0.72, -4.15);
    parent.add(dorsalAerial);
  }
}

function addKsrMount(root: THREE.Group, weaponRig: THREE.Group, tiers: ReturnType<typeof createAircraftTiers>, id: string, position: Vec3Tuple) {
  const carrierBraceTopY = KSR_CARRIER_BEAM_BOTTOM_Y + KSR_CARRIER_BRACE_OVERLAP;

  function addCarrierBeam(parent: THREE.Group, tier: DetailTier) {
    const thickness = tier === "ultra" ? 0.11 : tier === "high" ? 0.09 : 0.065;
    const beam = createVerticalSurface([
      [position[2] - 0.48, mainWingUndersideY(tier)],
      [position[2] + 0.4, mainWingUndersideY(tier)],
      [position[2] + 0.23, KSR_CARRIER_BEAM_BOTTOM_Y],
      [position[2] - 0.2, KSR_CARRIER_BEAM_BOTTOM_Y],
    ], thickness, tier === "low" ? undersidePaint : aluminumPaint);
    beam.position.x = position[0];
    beam.name = `tu16-tapered-ksr-carrier:${id}:${tier}`;
    parent.add(beam);
  }

  addCarrierBeam(tiers.ultra, "ultra");
  addCarrierBeam(tiers.high, "high");
  addCarrierBeam(tiers.low, "low");

  function mountPieces(tier: "ultra" | "high"): readonly AirWeaponMountPiece[] {
    const railHeight = tier === "ultra" ? 0.07 : 0.08;
    const railContactY = 0.165;
    const railTopY = railContactY + railHeight;
    const braceTopRelativeY = carrierBraceTopY - position[1];
    const braceHeight = braceTopRelativeY - railTopY;
    const braceCenterY = (railTopY + braceTopRelativeY) * 0.5;
    return [
      {
        offset: [0, railContactY + railHeight * 0.5, 0],
        size: [tier === "ultra" ? 0.22 : 0.19, railHeight, tier === "ultra" ? 0.76 : 0.68],
      },
      {
        offset: [0, braceCenterY, tier === "ultra" ? -0.22 : -0.18],
        size: [tier === "ultra" ? 0.075 : 0.07, braceHeight, 0.1],
      },
      {
        offset: [0, braceCenterY, tier === "ultra" ? 0.22 : 0.18],
        size: [tier === "ultra" ? 0.075 : 0.07, braceHeight, 0.1],
      },
    ];
  }

  const ultraPieces = mountPieces("ultra");
  const highPieces = mountPieces("high");
  const mount = addAirWeaponMount(root, weaponRig, id, position, {
    ultraParent: tiers.ultra,
    highParent: tiers.high,
    ultraPieces,
    highPieces,
  });
  const weaponUpperContactY = ultraPieces[0].offset[1] - ultraPieces[0].size[1] * 0.5;
  mount.userData.weaponUpperContactY = weaponUpperContactY;
  mount.userData.weaponContactOverlap = KSR_WEAPON_CONTACT_OVERLAP;
  mount.userData.weaponContactSource = "ultra-carrier-rail-aabb-lower-face";

  const lowRailHeight = 0.08;
  const lowRailTopY = weaponUpperContactY + lowRailHeight;
  const lowBraceTopRelativeY = carrierBraceTopY - position[1];
  const lowGroup = new THREE.Group();
  lowGroup.position.set(...position);
  const lowCradle = new THREE.Mesh(new THREE.BoxGeometry(0.16, lowRailHeight, 0.48), aircraftPanelMaterial);
  lowCradle.position.y = weaponUpperContactY + lowRailHeight * 0.5;
  lowGroup.add(lowCradle);
  const lowBrace = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, lowBraceTopRelativeY - lowRailTopY, 0.12),
    aircraftPanelMaterial,
  );
  lowBrace.position.set(0, (lowRailTopY + lowBraceTopRelativeY) * 0.5, -0.06);
  lowGroup.add(lowBrace);
  tiers.low.add(lowGroup);
}

export function createTu16Model() {
  const root = new THREE.Group();
  root.name = "Tu-16K Badger-G visual rig";
  const tiers = createAircraftTiers(root);
  const surfaceMarkings: THREE.Object3D[] = [];
  addStaticAirframe(tiers.ultra, "ultra", surfaceMarkings);
  addStaticAirframe(tiers.high, "high", surfaceMarkings);
  addStaticAirframe(tiers.low, "low", surfaceMarkings);

  for (const side of [-1, 1]) {
    addNavigationLight(root, root, side, [side * (halfSpan - 0.06), 0.2, 3.12], 0.07);
  }

  const weaponRig = new THREE.Group();
  weaponRig.name = "tu16-heavy-anti-ship-weapon-rig";
  root.add(weaponRig);
  for (const station of TU16K_MODEL_STATIONS) {
    addKsrMount(root, weaponRig, tiers, station.id, station.position);
  }

  root.userData.surfaceMarkings = surfaceMarkings;
  root.userData.mainWingSweepDeg = WING_SWEEP_DEG;
  root.userData.weaponStationPositions = Object.fromEntries(
    TU16K_MODEL_STATIONS.map((station) => [station.id, [...station.position]]),
  );
  root.userData.ksr5MountedScaleAudit = {
    carrierMetersPerUnit: 2,
    currentRuntimeMountedScale: 1.042,
    expectedRealLengthMeters: 10.52,
    requiresWeaponProfileFollowUp: false,
  };
  tiers.ultra.visible = true;
  tiers.high.visible = false;
  tiers.low.visible = false;
  const finished = finishAircraftModel(root, tiers, {
    length,
    realLengthMeters: dimensions.realLengthMeters,
    realWingspanMeters: dimensions.realWingspanMeters,
    engines: [
      new THREE.Vector3(-2.05, 0.03, 4.65),
      new THREE.Vector3(2.05, 0.03, 4.65),
    ],
    detailTags: [
      "faceted-glazed-nose",
      "glazed-nose",
      "framed-cockpit-windows",
      "full-scale-2m-per-unit",
      "strongly-swept-wings",
      "swept-wings",
      "integrated-wing-root-nacelles",
      "wing-engine-pods",
      "long-engine-nacelles",
      "large-dorsal-fin",
      "swept-tailplane",
      "tail-gun-turret",
      "twin-tail-cannon",
      "ventral-radar",
      "heavy-ksr-carry-beam",
    ],
    lodNear: 108,
    lodMedium: 310,
  });
  finished.userData.referenceDimensions = dimensions;
  return finished;
}
