import * as THREE from "three";
import { createLoftedHullGeometry, createSheerDeckGeometry, createWaterlineBandGeometry, type HullStation } from "../../models/hull-geometry";
import { addModelStrut as addStrut, createChamferedSlopedBoxGeometry, createSlopedBoxGeometry as slopedBox } from "../../models/model-primitives";
import { applySurfaceDetail } from "../../visual/material-textures";
import { addPointDefenseMount, addSensorAnchor, addWeaponHardpoint, createPlatformModelSlots } from "../model-slots";
import type { EnemyPlatformDefinition } from "../types";

const MOSKVA_HULL: readonly HullStation[] = [
  { x: -41.5, deckHalf: 3.7, shoulderHalf: 3.55, waterlineHalf: 3.25, keelHalf: 1.2, deckY: 5.7, shoulderY: 3.2, waterlineY: 0.3, keelY: -0.9 },
  { x: -38, deckHalf: 4.25, shoulderHalf: 4.05, waterlineHalf: 3.65, keelHalf: 1.35, deckY: 5.75, shoulderY: 3.15, waterlineY: 0.28, keelY: -1 },
  { x: -28, deckHalf: 4.55, shoulderHalf: 4.32, waterlineHalf: 3.85, keelHalf: 1.45, deckY: 5.85, shoulderY: 3.12, waterlineY: 0.27, keelY: -1.08 },
  { x: -8, deckHalf: 4.62, shoulderHalf: 4.4, waterlineHalf: 3.92, keelHalf: 1.48, deckY: 5.94, shoulderY: 3.12, waterlineY: 0.27, keelY: -1.1 },
  { x: 14, deckHalf: 4.58, shoulderHalf: 4.35, waterlineHalf: 3.8, keelHalf: 1.4, deckY: 6.04, shoulderY: 3.2, waterlineY: 0.3, keelY: -1.02 },
  { x: 27, deckHalf: 4.05, shoulderHalf: 3.78, waterlineHalf: 3.15, keelHalf: 1.08, deckY: 6.25, shoulderY: 3.55, waterlineY: 0.36, keelY: -0.78 },
  { x: 34, deckHalf: 3, shoulderHalf: 2.7, waterlineHalf: 2.05, keelHalf: 0.65, deckY: 6.55, shoulderY: 3.95, waterlineY: 0.45, keelY: -0.42 },
  { x: 39, deckHalf: 1.45, shoulderHalf: 1.16, waterlineHalf: 0.75, keelHalf: 0.22, deckY: 6.92, shoulderY: 4.45, waterlineY: 0.55, keelY: -0.05 },
  { x: 41.5, deckHalf: 0.05, shoulderHalf: 0.04, waterlineHalf: 0.025, keelHalf: 0.01, deckY: 7.25, shoulderY: 4.9, waterlineY: 0.62, keelY: 0.38 },
];

function createMoskvaModel() {
  const ship = new THREE.Group();
  const slots = createPlatformModelSlots();
  const hullMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x75807e, metalness: 0.14, roughness: 0.5 }), "painted-metal", 0.3);
  const deckMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x6d5a4e, metalness: 0.08, roughness: 0.76 }), "weather-deck", 0.48);
  const superMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x8b9692, metalness: 0.13, roughness: 0.56 }), "painted-metal", 0.26);
  const darkMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x273235, metalness: 0.4, roughness: 0.48 }), "dark-metal", 0.32);
  const radarMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0xaab2aa, metalness: 0.22, roughness: 0.58 }), "painted-metal", 0.18);
  const missileMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x8a918b, metalness: 0.2, roughness: 0.54 }), "missile-skin", 0.2);

  const hull = new THREE.Mesh(createLoftedHullGeometry(MOSKVA_HULL), hullMaterial);
  const deck = new THREE.Mesh(createSheerDeckGeometry(MOSKVA_HULL), deckMaterial);
  const waterline = new THREE.Mesh(createWaterlineBandGeometry(MOSKVA_HULL), new THREE.MeshStandardMaterial({ color: 0x1a2021, roughness: 0.82 }));
  ship.add(hull, deck, waterline);

  const forwardHouse = new THREE.Mesh(createChamferedSlopedBoxGeometry(23, 7.4, 7.2, 0.48, 3.4, 1.2), superMaterial);
  forwardHouse.position.set(8, 9.65, 0);
  const bridge = new THREE.Mesh(createChamferedSlopedBoxGeometry(11.5, 4, 6.7, 0.42, 2.1, 0.7), superMaterial);
  bridge.position.set(14, 15.2, 0);
  const aftHouse = new THREE.Mesh(createChamferedSlopedBoxGeometry(20, 6.2, 7.25, 0.48, 1, 2.3), superMaterial);
  aftHouse.position.set(-13, 9.2, 0);
  ship.add(forwardHouse, bridge, aftHouse);

  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x172f35, emissive: 0x071a1d, emissiveIntensity: 0.38, metalness: 0.2, roughness: 0.3 });
  for (const side of [-1, 1])
    for (let x = 10; x <= 18; x += 1) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.1), windowMaterial);
      window.position.set(x, 15.65, side * 3.4);
      ship.add(window);
    }
  const windowBrows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.82, 0.09, 0.18), darkMaterial, 18);
  const windowBrowMatrix = new THREE.Matrix4();
  let windowBrowIndex = 0;
  for (const side of [-1, 1])
    for (let x = 10; x <= 18; x += 1) {
      windowBrowMatrix.makeTranslation(x, 15.96, side * 3.43);
      windowBrows.setMatrixAt(windowBrowIndex++, windowBrowMatrix);
    }
  windowBrows.instanceMatrix.needsUpdate = true;
  windowBrows.name = "Bridge window brows";
  ship.add(windowBrows);

  for (const [x, height] of [[-2.5, 6.4], [-8.2, 6.1]] as const) {
    const funnel = new THREE.Group();
    funnel.position.set(x, 14.1, 0);
    const casing = new THREE.Mesh(createChamferedSlopedBoxGeometry(4.25, height, 4.7, 0.34, 0.6, 1.1), superMaterial);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.35, 4.15), darkMaterial);
    cap.position.y = height * 0.5 + 0.08;
    const uptake = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.42, 3.3), darkMaterial);
    uptake.position.y = height * 0.5 + 0.42;
    funnel.add(casing, cap, uptake);
    ship.add(funnel);
  }

  const gunBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.15, 0.72, 14), darkMaterial);
  gunBase.position.set(33.5, 6.85, 0);
  const gunTurret = new THREE.Mesh(slopedBox(3.8, 1.9, 3.25, 0.85, 0.35), superMaterial);
  gunTurret.position.set(33.8, 8.1, 0);
  ship.add(gunBase, gunTurret);
  for (const z of [-0.32, 0.32]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6.2, 8), darkMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(37.3, 8.45, z);
    ship.add(barrel);
  }

  for (const side of [-1, 1])
    for (let bank = 0; bank < 4; bank++)
      for (let tier = 0; tier < 2; tier++) {
        const launcher = new THREE.Group();
        launcher.position.set(12 - bank * 5.1, 7.1 + tier * 0.62, side * (4.15 + tier * 0.58));
        launcher.rotation.z = 0.2;
        launcher.rotation.y = -side * 0.11;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 6.2, 12), missileMaterial);
        tube.rotation.z = Math.PI / 2;
        const rear = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), darkMaterial);
        rear.rotation.y = -Math.PI / 2;
        rear.position.x = -3.11;
        const cover = new THREE.Mesh(new THREE.CircleGeometry(0.56, 12), darkMaterial);
        cover.rotation.y = Math.PI / 2;
        cover.position.x = 3.12;
        const hardpoint = new THREE.Object3D();
        hardpoint.position.x = 3.34;
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.3, 1.48), darkMaterial);
        saddle.position.set(-0.35, -0.72, 0);
        const forwardClamp = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.075, 6, 18), darkMaterial);
        const aftClamp = forwardClamp.clone();
        forwardClamp.rotation.y = aftClamp.rotation.y = Math.PI / 2;
        forwardClamp.position.x = 1.9;
        aftClamp.position.x = -1.9;
        launcher.add(saddle, tube, rear, cover, forwardClamp, aftClamp, hardpoint);
        ship.add(launcher);
        const index = (side > 0 ? 8 : 0) + bank * 2 + tier;
        addWeaponHardpoint(slots, hardpoint, `bazalt-${String(index + 1).padStart(2, "0")}`, "bazalt-canisters", new THREE.Vector3(1, 0, 0), cover, "blow-off", side < 0 ? "port" : "starboard");
      }

  const forwardMast = new THREE.Group();
  forwardMast.position.set(7, 15.3, 0);
  for (const side of [-1, 1]) addStrut(forwardMast, new THREE.Vector3(-1.8, 0, side * 2.1), new THREE.Vector3(0, 11, side * 0.5), 0.15, darkMaterial);
  addStrut(forwardMast, new THREE.Vector3(1.7, 0, 0), new THREE.Vector3(0, 11, 0), 0.15, darkMaterial);
  const topPair = new THREE.Group();
  topPair.position.y = 11.6;
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.5, 0.16), radarMaterial);
    panel.position.z = side * 0.18;
    panel.rotation.y = side > 0 ? 0 : Math.PI;
    const frame = new THREE.Group();
    frame.position.z = side * 0.29;
    frame.rotation.y = side > 0 ? 0 : Math.PI;
    for (const y of [-1.22, 1.22]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.12, 0.1), darkMaterial);
      beam.position.y = y;
      frame.add(beam);
    }
    for (const x of [-2.72, 2.72]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.1), darkMaterial);
      beam.position.x = x;
      frame.add(beam);
    }
    const emitters = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.045, 6),
      radarMaterial,
      45,
    );
    let emitterIndex = 0;
    const emitterMatrix = new THREE.Matrix4();
    for (let row = -2; row <= 2; row++)
      for (let column = -4; column <= 4; column++) {
        emitterMatrix.makeTranslation(column * 0.52, row * 0.42, 0.06);
        emitters.setMatrixAt(emitterIndex++, emitterMatrix);
      }
    emitters.instanceMatrix.needsUpdate = true;
    emitters.name = "MR-800 array modules";
    frame.add(emitters);
    topPair.add(panel, frame);
  }
  topPair.userData.moduleCount = 90;
  forwardMast.add(topPair);
  ship.add(forwardMast);
  addSensorAnchor(slots, "top-pair", topPair, true);

  const aftMast = new THREE.Group();
  aftMast.position.set(-10.5, 14.2, 0);
  for (const side of [-1, 1]) addStrut(aftMast, new THREE.Vector3(-1.5, 0, side * 1.8), new THREE.Vector3(0, 9.5, side * 0.42), 0.13, darkMaterial);
  const topSteer = new THREE.Group();
  topSteer.position.y = 9.8;
  const topSteerSpine = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.16, 0.18), darkMaterial);
  topSteer.add(topSteerSpine);
  const topSteerElements = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 1.1, 0.08), radarMaterial, 26);
  const topSteerMatrix = new THREE.Matrix4();
  let topSteerIndex = 0;
  for (const side of [-1, 1])
    for (let column = -6; column <= 6; column++) {
      topSteerMatrix.makeTranslation(column * 0.49, 0, side * 0.13);
      topSteerElements.setMatrixAt(topSteerIndex++, topSteerMatrix);
    }
  topSteerElements.instanceMatrix.needsUpdate = true;
  topSteerElements.name = "MR-700 array elements";
  topSteer.userData.moduleCount = 26;
  topSteer.add(topSteerElements);
  aftMast.add(topSteer);
  ship.add(aftMast);
  addSensorAnchor(slots, "top-steer", topSteer, true);

  const fireControl = new THREE.Group();
  fireControl.position.set(18, 18, 0);
  const fireControlDish = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), radarMaterial);
  fireControlDish.rotation.z = -Math.PI / 2;
  fireControl.add(fireControlDish);
  ship.add(fireControl);
  addSensorAnchor(slots, "argument", fireControl, false);

  const s300Deck = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.24, 24), darkMaterial);
  s300Deck.position.set(-24, 6.15, 0);
  ship.add(s300Deck);
  for (let ring = 0; ring < 2; ring++)
    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * Math.PI * 2 + ring * 0.28;
      const lid = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12), superMaterial);
      lid.rotation.x = -Math.PI / 2;
      lid.position.set(-24 + Math.cos(angle) * (1.7 + ring * 1.45), 6.3, Math.sin(angle) * (1.7 + ring * 1.45));
      ship.add(lid);
    }

  for (const side of [-1, 1]) {
    const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 3.3, 4, 10), new THREE.MeshStandardMaterial({ color: 0xd8d5c8, roughness: 0.7 }));
    boat.rotation.z = Math.PI / 2;
    boat.position.set(-5, 9, side * 4.35);
    ship.add(boat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(64, 0.07, 0.07), radarMaterial);
    rail.position.set(-1, 6.62, side * 4.48);
    ship.add(rail);
  }

  const plating = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 3.2, 0.055), darkMaterial, 20);
  const platingMatrix = new THREE.Matrix4();
  let platingIndex = 0;
  for (const side of [-1, 1])
    for (let x = -34; x <= 38; x += 8) {
      const station = MOSKVA_HULL.reduce((nearest, candidate) => Math.abs(candidate.x - x) < Math.abs(nearest.x - x) ? candidate : nearest);
      platingMatrix.makeTranslation(x, 3.65, side * (station.shoulderHalf + 0.035));
      plating.setMatrixAt(platingIndex++, platingMatrix);
    }
  plating.instanceMatrix.needsUpdate = true;
  plating.name = "Hull plating seams";
  ship.add(plating);

  const scuppers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), darkMaterial, 30);
  const scupperMatrix = new THREE.Matrix4();
  let scupperIndex = 0;
  for (const side of [-1, 1])
    for (let x = -28; x <= 28; x += 4) {
      const station = MOSKVA_HULL.reduce((nearest, candidate) => Math.abs(candidate.x - x) < Math.abs(nearest.x - x) ? candidate : nearest);
      scupperMatrix.makeTranslation(x, 5.75, side * (station.deckHalf + 0.04));
      scuppers.setMatrixAt(scupperIndex++, scupperMatrix);
    }
  scuppers.instanceMatrix.needsUpdate = true;
  scuppers.name = "Hull scuppers";
  ship.add(scuppers);

  for (const side of [-1, 1])
    for (const [index, x] of [-7, -14, -21].entries()) {
      const turret = new THREE.Group();
      turret.position.set(x, 7.25, side * 4.05);
      turret.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.78, 0.48, 12),
        darkMaterial,
      );
      const housing = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.55,
          12,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.72,
        ),
        superMaterial,
      );
      housing.position.y = 0.42;
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.09, 1.8, 8),
        darkMaterial,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(1.05, 0.55, 0);
      const muzzle = new THREE.Object3D();
      muzzle.position.set(1.95, 0.55, 0);
      turret.add(base, housing, barrel, muzzle);
      ship.add(turret);
      addPointDefenseMount(
        slots,
        `ak-630-${side > 0 ? "starboard" : "port"}-${index + 1}`,
        turret,
        muzzle,
        THREE.MathUtils.degToRad(side > 0 ? 75 : -75),
        THREE.MathUtils.degToRad(100),
        THREE.MathUtils.degToRad(95),
        THREE.MathUtils.degToRad(4),
      );
    }

  ship.userData.platformSlots = slots;
  ship.userData.hullMaterial = hullMaterial;
  ship.userData.hullLength = 83;
  ship.userData.hullBeam = 9.24;
  ship.userData.hullLengthBeamRatio = 83 / 9.24;
  ship.userData.detail = [forwardHouse, bridge, aftHouse, forwardMast, aftMast, ...slots.weaponHardpoints.map((hardpoint) => hardpoint.mount.parent!), ...slots.pointDefenseMounts.map((mount) => mount.traverse)];
  return ship;
}

export const MOSKVA = {
  id: "slava-moskva",
  name: "MOSKVA",
  className: "SLAVA CLASS / PROJECT 1164",
  nation: "USSR / RUSSIA",
  era: "1980s-2000s",
  role: "GUIDED MISSILE CRUISER / SURFACE STRIKE",
  defaultScenarioRange: 650,
  radarCrossSection: 15,
  significantHeightMeters: 36,
  mobility: {
    maxSpeedKnots: 32,
    cruiseSpeedKnots: 20,
    patrolSpeedKnots: 12,
    accelerationKnotsPerSecond: 0.42,
    turnRateDeg: 1.35,
    decisionInterval: 1,
    standoffRange: 520,
    standoffTolerance: 70,
  },
  defaultThreat: "P-500",
  sensorSlots: [
    { id: "air-search", displayName: "MR-800 VOSKHOD / TOP PAIR", role: "air-search", anchorId: "top-pair", maxRange: 920, updateInterval: 0.9, precision: 0.78, radarHeight: 35 },
    { id: "surface-search", displayName: "MR-700 FREGAT / TOP STEER", role: "surface-search", anchorId: "top-steer", maxRange: 760, updateInterval: 0.72, precision: 0.84, radarHeight: 31 },
    { id: "strike-control", displayName: "ARGUMENT / FRONT DOOR", role: "fire-control", anchorId: "argument", maxRange: 680, updateInterval: 0.55, precision: 0.9, radarHeight: 24 },
  ],
  weaponSlots: [
    { id: "bazalt-canisters", displayName: "16 x P-500 BAZALT INCLINED CANISTERS", family: "inclined-canister", compatibleThreats: ["P-500"], fireControlSensorId: "strike-control", capacity: 16, minimumInterval: 0.72, exitSpeed: 3.8, boostDuration: 3.8, guidanceTakeover: 4.8, minimumTrackQuality: 0.3, minimumTrackAge: 2.4, fireControlDelay: 1.6, passiveTargeting: { minimumTrackQuality: 0.18, minimumTrackAge: 6, fireControlDelay: 2.5, maximumUncertainty: 180 }, fireControlTrackHoldover: 2.2, postCommitTrackLossAbort: 45, datalinkUpdateInterval: 1.4, datalinkLatency: 0.35, datalinkMinimumQuality: 0.18, salvoPattern: "alternate-groups", salvoDoctrine: { minimumSalvoSize: 2, maximumSalvoSize: 8, maximumWeaponsInFlight: 8, expectedLeakProbability: 0.48, targetHullEstimate: 100, assessmentDelay: 9, hitReportReliability: 0.82, arrivalWindow: 1.5, maximumSpeedCompensation: 0.16 } },
  ],
  survivability: {
    hull: 100,
    damageZones: [
      { label: "BOW", minimumLongitudinalFraction: 0.42, systems: ["strike-control", "bazalt-canisters", "countermeasures"] },
      { label: "FORWARD", minimumLongitudinalFraction: 0.08, systems: ["air-search", "strike-control", "bazalt-canisters", "electronic-support"] },
      { label: "AMIDSHIPS", minimumLongitudinalFraction: -0.38, systems: ["surface-search", "propulsion", "electronic-warfare", "electronic-support", "countermeasures"] },
      { label: "AFT", minimumLongitudinalFraction: -Infinity, systems: ["propulsion", "point-defense", "surface-search"] },
    ],
    damageControl: {
      tickInterval: 2,
      hullDamageFactor: 0.025,
      controlledFireFactor: 0.78,
      controlledFloodingFactor: 0.84,
      uncontrolledFireFactor: 1.04,
      uncontrolledFloodingFactor: 1.025,
      containmentThreshold: 3,
    },
    pointDefense: {
      sensorRange: 115,
      sensorUpdateInterval: 0.72,
      minimumTrackQuality: 0.3,
      trackMemory: 3.2,
      reactionTime: 1.35,
      channels: 2,
      range: 42,
      interval: 0.42,
      reengagementDelay: 0.9,
      effectorSpeed: 40,
      minimumTimeOfFlight: 0.18,
      engagementCapacity: 6,
      basePk: 0.38,
      localSaturationPenalty: 0.08,
      engagementsPerTarget: 2,
    },
    softKill: {
      ecmStrength: 0.62,
      burnThroughRange: 24,
      decoyRounds: 8,
      decoyCooldown: 2.2,
      decoyDeployRange: 90,
      decoyRcs: 9,
    },
  },
  buildModel: createMoskvaModel,
} as const satisfies EnemyPlatformDefinition;
