import * as THREE from "three";
import { createSheerDeckGeometry, createWaterlineBandGeometry, type HullStation } from "../../models/hull-geometry";
import { addModelStrut as addStrut, createChamferedSlopedBoxGeometry, createSlopedBoxGeometry as slopedBox } from "../../models/model-primitives";
import { applySurfaceDetail } from "../../visual/material-textures";
import { registerAssetDetailLod } from "../../visual/asset-detail-lod";
import { addPointDefenseMount, addSensorAnchor, addWeaponHardpoint, createPlatformModelSlots } from "../model-slots";
import type { EnemyPlatformDefinition } from "../types";

// The local 83-unit hull maps to Project 1164's 186.4 m overall length.
// Maximum moulded beam is therefore 9.26 units for the documented 20.8 m.
// Station rhythm and feature placement were checked against US Navy/NARA
// imagery DF-ST-88-07834, DN-ST-87-00347, DN-ST-89-08744 and DN-SN-90-10227.
const MOSKVA_HULL: readonly HullStation[] = [
  { x: -41.5, deckHalf: 3.68, shoulderHalf: 3.52, waterlineHalf: 3.18, keelHalf: 1.12, deckY: 5.7, shoulderY: 3.15, waterlineY: 0.3, keelY: -0.92 },
  { x: -39.2, deckHalf: 4.16, shoulderHalf: 3.98, waterlineHalf: 3.58, keelHalf: 1.3, deckY: 5.73, shoulderY: 3.12, waterlineY: 0.28, keelY: -1.0 },
  { x: -33, deckHalf: 4.48, shoulderHalf: 4.28, waterlineHalf: 3.8, keelHalf: 1.42, deckY: 5.8, shoulderY: 3.1, waterlineY: 0.27, keelY: -1.07 },
  { x: -22, deckHalf: 4.6, shoulderHalf: 4.39, waterlineHalf: 3.91, keelHalf: 1.48, deckY: 5.86, shoulderY: 3.08, waterlineY: 0.27, keelY: -1.1 },
  { x: 0, deckHalf: 4.63, shoulderHalf: 4.41, waterlineHalf: 3.92, keelHalf: 1.5, deckY: 5.92, shoulderY: 3.1, waterlineY: 0.27, keelY: -1.1 },
  { x: 17, deckHalf: 4.56, shoulderHalf: 4.32, waterlineHalf: 3.76, keelHalf: 1.38, deckY: 6.04, shoulderY: 3.2, waterlineY: 0.3, keelY: -1.0 },
  { x: 28, deckHalf: 4.02, shoulderHalf: 3.72, waterlineHalf: 3.08, keelHalf: 1.02, deckY: 6.27, shoulderY: 3.52, waterlineY: 0.36, keelY: -0.73 },
  { x: 35, deckHalf: 2.68, shoulderHalf: 2.37, waterlineHalf: 1.72, keelHalf: 0.55, deckY: 6.57, shoulderY: 4.02, waterlineY: 0.46, keelY: -0.34 },
  { x: 39.3, deckHalf: 1.08, shoulderHalf: 0.84, waterlineHalf: 0.46, keelHalf: 0.14, deckY: 6.9, shoulderY: 4.5, waterlineY: 0.56, keelY: 0.02 },
  { x: 41.5, deckHalf: 0.04, shoulderHalf: 0.035, waterlineHalf: 0.02, keelHalf: 0.008, deckY: 7.13, shoulderY: 4.94, waterlineY: 0.64, keelY: 0.42 },
];

function createMoskvaHullGeometry(stations: readonly HullStation[]) {
  const ringSize = 8;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const station of stations) {
    const bowFactor = THREE.MathUtils.clamp((station.x - 32) / 9.5, 0, 1);
    const sternFactor = THREE.MathUtils.clamp((-37 - station.x) / 4.5, 0, 1);
    const ring = [
      [station.deckY, -station.deckHalf, 0],
      [station.shoulderY, -station.shoulderHalf, -0.42 * bowFactor + 0.14 * sternFactor],
      [station.waterlineY, -station.waterlineHalf, -1.22 * bowFactor + 0.34 * sternFactor],
      [station.keelY, -station.keelHalf, -2.45 * bowFactor + 0.65 * sternFactor],
      [station.keelY, station.keelHalf, -2.45 * bowFactor + 0.65 * sternFactor],
      [station.waterlineY, station.waterlineHalf, -1.22 * bowFactor + 0.34 * sternFactor],
      [station.shoulderY, station.shoulderHalf, -0.42 * bowFactor + 0.14 * sternFactor],
      [station.deckY, station.deckHalf, 0],
    ] as const;
    for (const [y, z, xOffset] of ring) vertices.push(station.x + xOffset, y, z);
  }
  for (let station = 0; station < stations.length - 1; station++) {
    const current = station * ringSize;
    const next = current + ringSize;
    for (let side = 0; side < ringSize - 1; side++) {
      const a = current + side;
      const b = next + side;
      const c = next + side + 1;
      const d = current + side + 1;
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let point = 1; point < ringSize - 1; point++) indices.push(0, point + 1, point);
  const bow = (stations.length - 1) * ringSize;
  for (let point = 1; point < ringSize - 1; point++) indices.push(bow, bow + point, bow + point + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createFlightDeckGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-41.3, -3.25);
  shape.lineTo(-40.15, -3.9);
  shape.lineTo(-25.2, -4.08);
  shape.lineTo(-24.25, -3.35);
  shape.lineTo(-24.25, 3.35);
  shape.lineTo(-25.2, 4.08);
  shape.lineTo(-40.15, 3.9);
  shape.lineTo(-41.3, 3.25);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createMoskvaModel() {
  // Ship-local axes: +X bow, -Z starboard, +Z port.
  const ship = new THREE.Group();
  const slots = createPlatformModelSlots();
  const hullMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x75807e, metalness: 0.14, roughness: 0.5 }), "painted-metal", 0.3);
  const deckMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x6d5a4e, metalness: 0.08, roughness: 0.76 }), "weather-deck", 0.48);
  const superMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x8b9692, metalness: 0.13, roughness: 0.56 }), "painted-metal", 0.26);
  const darkMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x273235, metalness: 0.4, roughness: 0.48 }), "dark-metal", 0.32);
  const radarMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0xaab2aa, metalness: 0.22, roughness: 0.58 }), "painted-metal", 0.18);
  const missileMaterial = applySurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x8a918b, metalness: 0.2, roughness: 0.54 }), "missile-skin", 0.2);

  const hull = new THREE.Mesh(createMoskvaHullGeometry(MOSKVA_HULL), hullMaterial);
  const deck = new THREE.Mesh(createSheerDeckGeometry(MOSKVA_HULL), deckMaterial);
  const waterline = new THREE.Mesh(createWaterlineBandGeometry(MOSKVA_HULL), new THREE.MeshStandardMaterial({ color: 0x1a2021, roughness: 0.82 }));
  ship.add(hull, deck, waterline);

  // Project 1164's silhouette is a sequence of low, sharply stepped volumes.
  // Keeping each level independent avoids the former single seven-storey slab.
  const forwardHouse = new THREE.Mesh(createChamferedSlopedBoxGeometry(20.5, 3.35, 6.15, 0.46, 2.45, 0.75), superMaterial);
  forwardHouse.position.set(7.6, 7.98, 0);
  const operationsDeck = new THREE.Mesh(createChamferedSlopedBoxGeometry(15.2, 2.45, 5.65, 0.4, 1.85, 0.6), superMaterial);
  operationsDeck.position.set(10.2, 10.38, 0);
  const bridgeDeck = new THREE.Mesh(createChamferedSlopedBoxGeometry(11.8, 1.9, 5.2, 0.36, 1.35, 0.48), superMaterial);
  bridgeDeck.position.set(12.9, 12.08, 0);
  const bridge = new THREE.Mesh(createChamferedSlopedBoxGeometry(8.5, 1.62, 4.7, 0.32, 1.05, 0.4), superMaterial);
  bridge.position.set(15, 13.74, 0);
  const mastDeck = new THREE.Mesh(createChamferedSlopedBoxGeometry(6.8, 1.45, 4.55, 0.32, 0.85, 0.42), superMaterial);
  mastDeck.position.set(6.25, 12.2, 0);
  const machineryHouse = new THREE.Mesh(createChamferedSlopedBoxGeometry(16.2, 2.55, 5.95, 0.42, 0.85, 0.75), superMaterial);
  machineryHouse.position.set(-3.7, 7.55, 0);
  const aftControlHouse = new THREE.Mesh(createChamferedSlopedBoxGeometry(5.8, 3.65, 5.75, 0.4, 0.55, 0.62), superMaterial);
  aftControlHouse.position.set(-24.6, 8.05, 0);
  ship.add(forwardHouse, operationsDeck, bridgeDeck, bridge, mastDeck, machineryHouse, aftControlHouse);

  const flightDeck = new THREE.Mesh(createFlightDeckGeometry(), deckMaterial);
  flightDeck.position.y = 6.14;
  flightDeck.name = "Project 1164 clipped-corner helicopter flight deck";
  const hangar = new THREE.Mesh(createChamferedSlopedBoxGeometry(8.15, 3.72, 6.15, 0.34, 0.55, 0.45), superMaterial);
  hangar.position.set(-30.55, 8.15, 0);
  hangar.name = "Ka-25/Ka-27 helicopter hangar";
  const hangarDoor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.55, 4.45), darkMaterial);
  hangarDoor.position.set(-34.64, 8.0, 0);
  const landingRing = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.085, 6, 40), radarMaterial);
  landingRing.rotation.x = Math.PI / 2;
  landingRing.position.set(-37.35, 6.22, 0);
  const landingLine = new THREE.Mesh(new THREE.BoxGeometry(5.15, 0.04, 0.12), radarMaterial);
  landingLine.position.set(-37.25, 6.225, 0);
  const landingCross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.7), radarMaterial);
  landingCross.position.set(-37.35, 6.23, 0);
  ship.add(flightDeck, hangar, hangarDoor, landingRing, landingLine, landingCross);

  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x172f35, emissive: 0x071a1d, emissiveIntensity: 0.38, metalness: 0.2, roughness: 0.3 });
  for (const side of [-1, 1])
    for (let x = 11.8; x <= 18.2; x += 0.92) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.1), windowMaterial);
      window.position.set(x, 13.82, side * 2.39);
      ship.add(window);
    }
  for (let z = -1.72; z <= 1.72; z += 0.86) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.6), windowMaterial);
    window.position.set(18.72, 13.82, z);
    ship.add(window);
  }
  const windowBrows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.76, 0.08, 0.16), darkMaterial, 14);
  const windowBrowMatrix = new THREE.Matrix4();
  let windowBrowIndex = 0;
  for (const side of [-1, 1])
    for (let x = 11.8; x <= 18.2; x += 0.92) {
      windowBrowMatrix.makeTranslation(x, 14.08, side * 2.43);
      windowBrows.setMatrixAt(windowBrowIndex++, windowBrowMatrix);
    }
  windowBrows.instanceMatrix.needsUpdate = true;
  windowBrows.name = "Bridge window brows";
  ship.add(windowBrows);

  for (const side of [-1, 1]) {
    const bridgeWing = new THREE.Mesh(createChamferedSlopedBoxGeometry(3.1, 0.42, 1.2, 0.16, 0.35, 0.18), superMaterial);
    bridgeWing.position.set(15.0, 13.05, side * 2.85);
    ship.add(bridgeWing);
  }

  for (const [x, height] of [[-1.0, 4.25], [-6.15, 4.05]] as const) {
    const funnel = new THREE.Group();
    funnel.position.set(x, 10.85, 0);
    const casing = new THREE.Mesh(createChamferedSlopedBoxGeometry(3.85, height, 3.9, 0.32, 0.55, 0.72), superMaterial);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.28, 3.4), darkMaterial);
    cap.position.y = height * 0.5 + 0.07;
    const uptake = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.36, 2.75), darkMaterial);
    uptake.position.y = height * 0.5 + 0.38;
    funnel.add(casing, cap, uptake);
    ship.add(funnel);
  }

  const gunBase = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 2.05, 0.68, 16), darkMaterial);
  gunBase.position.set(33.1, 6.88, 0);
  const gunTurret = new THREE.Mesh(slopedBox(3.65, 1.75, 3.15, 0.82, 0.32), superMaterial);
  gunTurret.position.set(33.35, 8.02, 0);
  const gunRoof = new THREE.Mesh(createChamferedSlopedBoxGeometry(2.3, 0.38, 2.4, 0.2, 0.48, 0.18), superMaterial);
  gunRoof.position.set(33.05, 9.0, 0);
  ship.add(gunBase, gunTurret, gunRoof);
  for (const z of [-0.32, 0.32]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.16, 4.85, 8), darkMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(36.55, 8.32, z);
    ship.add(barrel);
  }

  const bazaltElevation = THREE.MathUtils.degToRad(8);
  const bazaltOutboardYaw = THREE.MathUtils.degToRad(5.2);
  for (const side of [-1, 1])
    for (let bank = 0; bank < 4; bank++) {
      const bankX = 12.4 - bank * 5.0;
      const pairCradle = new THREE.Group();
      pairCradle.position.set(bankX - 0.25, 6.72, side * 4.22);
      pairCradle.rotation.z = bazaltElevation;
      pairCradle.rotation.y = -side * bazaltOutboardYaw;
      const cradleBed = new THREE.Mesh(new THREE.BoxGeometry(4.95, 0.34, 2.12), darkMaterial);
      const cradleAftBulkhead = new THREE.Mesh(createChamferedSlopedBoxGeometry(0.95, 1.05, 2.18, 0.14, 0.12, 0.16), superMaterial);
      cradleAftBulkhead.position.x = -2.25;
      const cradleForwardBrace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 2.0), darkMaterial);
      cradleForwardBrace.position.x = 1.75;
      pairCradle.add(cradleBed, cradleAftBulkhead, cradleForwardBrace);
      pairCradle.name = `P-500 paired cradle ${side > 0 ? "port" : "starboard"} ${bank + 1}`;
      ship.add(pairCradle);
      for (let tier = 0; tier < 2; tier++) {
        const launcher = new THREE.Group();
        launcher.position.set(bankX, 7.02 + tier * 0.44, side * (3.96 + tier * 0.66));
        launcher.rotation.z = bazaltElevation;
        launcher.rotation.y = -side * bazaltOutboardYaw;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.59, 0.65, 5.55, 14), missileMaterial);
        tube.rotation.z = Math.PI / 2;
        const rear = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), darkMaterial);
        rear.rotation.y = -Math.PI / 2;
        rear.position.x = -2.79;
        const cover = new THREE.Mesh(new THREE.CircleGeometry(0.57, 14), darkMaterial);
        cover.rotation.y = Math.PI / 2;
        cover.position.x = 2.79;
        const hardpoint = new THREE.Object3D();
        hardpoint.position.x = 3.04;
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.28, 1.45), darkMaterial);
        saddle.position.set(-0.3, -0.68, 0);
        const forwardClamp = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.072, 6, 18), darkMaterial);
        const aftClamp = forwardClamp.clone();
        forwardClamp.rotation.y = aftClamp.rotation.y = Math.PI / 2;
        forwardClamp.position.x = 1.7;
        aftClamp.position.x = -1.7;
        launcher.add(saddle, tube, rear, cover, forwardClamp, aftClamp, hardpoint);
        launcher.name = `P-500 canister ${side > 0 ? "port" : "starboard"} ${bank + 1}-${tier + 1}`;
        ship.add(launcher);
        const index = (side > 0 ? 8 : 0) + bank * 2 + tier;
        addWeaponHardpoint(slots, hardpoint, `bazalt-${String(index + 1).padStart(2, "0")}`, "bazalt-canisters", new THREE.Vector3(1, 0, 0), cover, "blow-off", side < 0 ? "starboard" : "port");
      }
    }

  // MR-700 Top Steer belongs on the forward/main mast; MR-800 Top Pair is
  // carried by the aftermast.  The former model had these landmarks reversed.
  const forwardMast = new THREE.Group();
  forwardMast.position.set(6.15, 11.55, 0);
  for (const side of [-1, 1])
    addStrut(forwardMast, new THREE.Vector3(-1.75, 0, side * 1.72), new THREE.Vector3(0, 6.7, side * 0.32), 0.13, darkMaterial);
  addStrut(forwardMast, new THREE.Vector3(1.45, 0, 0), new THREE.Vector3(0, 6.7, 0), 0.13, darkMaterial);
  const forwardPlatform = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.16, 2.25), darkMaterial);
  forwardPlatform.position.y = 5.15;
  forwardMast.add(forwardPlatform);
  const topSteer = new THREE.Group();
  topSteer.position.y = 7.15;
  const topSteerAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 8), darkMaterial);
  topSteerAxle.rotation.x = Math.PI / 2;
  topSteer.add(topSteerAxle);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.85, 1.25, 0.15), radarMaterial);
    panel.position.z = side * 0.18;
    topSteer.add(panel);
  }
  const topSteerElements = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 1.05, 0.08), darkMaterial, 22);
  const topSteerMatrix = new THREE.Matrix4();
  let topSteerIndex = 0;
  for (const side of [-1, 1])
    for (let column = -5; column <= 5; column++) {
      topSteerMatrix.makeTranslation(column * 0.43, 0, side * 0.28);
      topSteerElements.setMatrixAt(topSteerIndex++, topSteerMatrix);
    }
  topSteerElements.instanceMatrix.needsUpdate = true;
  topSteerElements.name = "MR-700 Top Steer array elements";
  topSteer.userData.moduleCount = 26;
  topSteer.add(topSteerElements);
  forwardMast.add(topSteer);
  ship.add(forwardMast);
  addSensorAnchor(slots, "top-steer", topSteer, true);

  const aftMast = new THREE.Group();
  aftMast.position.set(-10.0, 10.35, 0);
  for (const side of [-1, 1])
    addStrut(aftMast, new THREE.Vector3(-1.55, 0, side * 1.65), new THREE.Vector3(0, 7.25, side * 0.34), 0.13, darkMaterial);
  addStrut(aftMast, new THREE.Vector3(1.25, 0, 0), new THREE.Vector3(0, 7.25, 0), 0.12, darkMaterial);
  const aftPlatform = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 2.35), darkMaterial);
  aftPlatform.position.y = 5.4;
  aftMast.add(aftPlatform);
  const topPair = new THREE.Group();
  topPair.position.y = 7.75;
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.95, 2.12, 0.17), radarMaterial);
    panel.position.z = side * 0.18;
    const frame = new THREE.Group();
    frame.position.z = side * 0.29;
    for (const y of [-1.05, 1.05]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.09), darkMaterial);
      beam.position.y = y;
      frame.add(beam);
    }
    for (const x of [-2.47, 0, 2.47]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.09), darkMaterial);
      beam.position.x = x;
      frame.add(beam);
    }
    topPair.add(panel, frame);
  }
  topPair.userData.moduleCount = 90;
  aftMast.add(topPair);
  ship.add(aftMast);
  addSensorAnchor(slots, "top-pair", topPair, true);

  const fireControl = new THREE.Group();
  fireControl.position.set(17.25, 14.72, 0);
  const fireControlYoke = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 1.65), darkMaterial);
  const fireControlDish = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.74, 0.34, 20), radarMaterial);
  fireControlDish.rotation.z = Math.PI / 2;
  fireControlDish.position.set(0.05, 0.68, 0);
  fireControl.add(fireControlYoke, fireControlDish);
  ship.add(fireControl);
  addSensorAnchor(slots, "argument", fireControl, false);

  // Eight B-204 rotary launchers, arranged 2 x 4.  Each deck drum carries
  // eight visible tube covers; it is not the former twelve-disc circular VLS.
  const s300CellGeometry = new THREE.CircleGeometry(0.18, 10);
  s300CellGeometry.rotateX(-Math.PI / 2);
  const s300Cells = new THREE.InstancedMesh(s300CellGeometry, superMaterial, 64);
  const s300CellMatrix = new THREE.Matrix4();
  let s300CellIndex = 0;
  for (let row = 0; row < 2; row++)
    for (let column = 0; column < 4; column++) {
      const x = -13.0 - column * 2.55;
      const z = (row === 0 ? -1 : 1) * 1.42;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 24), darkMaterial);
      collar.position.set(x, 6.0, z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 5, 28), radarMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 6.095, z);
      ship.add(collar, rim);
      for (let cell = 0; cell < 8; cell++) {
        const angle = cell / 8 * Math.PI * 2 + (column + row) * 0.14;
        s300CellMatrix.makeTranslation(x + Math.cos(angle) * 0.58, 6.105, z + Math.sin(angle) * 0.58);
        s300Cells.setMatrixAt(s300CellIndex++, s300CellMatrix);
      }
    }
  s300Cells.instanceMatrix.needsUpdate = true;
  s300Cells.name = "Eight B-204 drums / sixty-four S-300F tube covers";
  ship.add(s300Cells);

  const topDome = new THREE.Group();
  topDome.position.set(-24.75, 9.88, 0);
  const topDomePedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 1.35, 14), superMaterial);
  topDomePedestal.position.y = 0.68;
  const topDomeYoke = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.25, 2.75), darkMaterial);
  topDomeYoke.position.y = 1.75;
  const topDomeFace = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.34, 0.55, 24), radarMaterial);
  topDomeFace.rotation.z = Math.PI / 2;
  topDomeFace.position.set(-0.08, 2.52, 0);
  const topDomeRim = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.1, 6, 28), darkMaterial);
  topDomeRim.rotation.y = Math.PI / 2;
  topDomeRim.position.copy(topDomeFace.position);
  topDome.add(topDomePedestal, topDomeYoke, topDomeFace, topDomeRim);
  topDome.name = "3R41 Volna / Top Dome fire-control radar";
  ship.add(topDome);

  const addOsaMount = (x: number, y: number) => {
    const mount = new THREE.Group();
    mount.position.set(x, y, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.12, 0.42, 12), darkMaterial);
    const cabin = new THREE.Mesh(slopedBox(1.55, 1.05, 1.48, 0.38, 0.18), superMaterial);
    cabin.position.y = 0.66;
    mount.add(base, cabin);
    for (const z of [-0.36, 0.36]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.12, 0.12), darkMaterial);
      rail.position.set(1.05, 1.27, z);
      rail.rotation.z = -0.12;
      mount.add(rail);
    }
    mount.name = "Osa-MA twin-arm launcher";
    ship.add(mount);
  };
  addOsaMount(26.3, 7.1);
  addOsaMount(-30.25, 10.2);

  for (const side of [-1, 1]) {
    const rbu = new THREE.Group();
    rbu.position.set(29.15, 7.15, side * 1.62);
    rbu.rotation.y = side * 0.08;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.42, 12), darkMaterial);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.62, 1.0, 12), superMaterial);
    cage.rotation.z = Math.PI / 2;
    cage.position.set(0.36, 0.63, 0);
    rbu.add(base, cage);
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.073, 1.12, 6), darkMaterial);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0.68, 0.63 + Math.sin(angle) * 0.46, Math.cos(angle) * 0.46);
      rbu.add(tube);
    }
    rbu.name = "RBU-6000 anti-submarine rocket launcher";
    ship.add(rbu);
  }

  for (const side of [-1, 1]) {
    const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 3.3, 4, 10), new THREE.MeshStandardMaterial({ color: 0xd8d5c8, roughness: 0.7 }));
    boat.rotation.z = Math.PI / 2;
    boat.position.set(-4.4, 9.0, side * 3.62);
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
    for (const [index, x] of [-7.0, -14.0, -21.0].entries()) {
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
        `ak-630-${side > 0 ? "port" : "starboard"}-${index + 1}`,
        turret,
        muzzle,
        THREE.MathUtils.degToRad(side > 0 ? 75 : -75),
        THREE.MathUtils.degToRad(100),
        THREE.MathUtils.degToRad(95),
        THREE.MathUtils.degToRad(4),
      );
    }

  const highDetail = new THREE.Group();
  highDetail.name = "Moskva high-detail representation";
  while (ship.children.length) highDetail.add(ship.children[0]);
  const createProxy = (medium: boolean) => {
    const proxy = new THREE.Group();
    proxy.name = `Moskva ${medium ? "medium" : "low"}-detail representation`;
    proxy.add(
      new THREE.Mesh(createMoskvaHullGeometry(MOSKVA_HULL), hullMaterial),
      new THREE.Mesh(createSheerDeckGeometry(MOSKVA_HULL), deckMaterial),
    );
    const houseSpecs = medium
      ? [
          [7.6, 7.98, 20.5, 6.15, 3.35],
          [10.2, 10.38, 15.2, 5.65, 2.45],
          [12.9, 12.08, 11.8, 5.2, 1.9],
          [15, 13.74, 8.5, 4.7, 1.62],
          [-3.7, 7.55, 16.2, 5.95, 2.55],
          [-24.6, 8.05, 5.8, 5.75, 3.65],
          [-30.55, 8.15, 8.15, 6.15, 3.72],
        ]
      : [
          [7.5, 8.2, 21, 6.1, 3.7],
          [11.8, 11.0, 15, 5.4, 2.7],
          [14.8, 13.2, 9, 4.7, 1.7],
          [-3.8, 7.7, 16, 5.9, 2.7],
          [-27.8, 8.15, 13.5, 6.05, 3.7],
        ];
    for (const [x, y, length, beam, height] of houseSpecs) {
      const house = new THREE.Mesh(
        medium
          ? createChamferedSlopedBoxGeometry(length, height, beam, 0.28, Math.min(0.9, length * 0.07), Math.min(0.5, height * 0.15))
          : new THREE.BoxGeometry(length, height, beam),
        superMaterial,
      );
      house.position.set(x, y, 0);
      proxy.add(house);
    }
    const flightDeckProxy = new THREE.Mesh(createFlightDeckGeometry(), deckMaterial);
    flightDeckProxy.position.y = 6.14;
    proxy.add(flightDeckProxy);
    if (medium) {
      const hangarDoorProxy = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 4.35), darkMaterial);
      hangarDoorProxy.position.set(-34.64, 8.0, 0);
      const landingRingProxy = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.075, 5, 32), radarMaterial);
      landingRingProxy.rotation.x = Math.PI / 2;
      landingRingProxy.position.set(-37.35, 6.22, 0);
      const landingLineProxy = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.04, 0.12), radarMaterial);
      landingLineProxy.position.set(-37.25, 6.225, 0);
      const frontWindowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 3.55), windowMaterial);
      frontWindowStrip.position.set(18.72, 13.82, 0);
      proxy.add(hangarDoorProxy, landingRingProxy, landingLineProxy, frontWindowStrip);
      for (const side of [-1, 1]) {
        const sideWindowStrip = new THREE.Mesh(new THREE.BoxGeometry(6.55, 0.36, 0.09), windowMaterial);
        sideWindowStrip.position.set(15.0, 13.82, side * 2.39);
        proxy.add(sideWindowStrip);
      }
    }
    for (const [x, height] of [[-1.0, 4.25], [-6.15, 4.05]] as const) {
      const funnel = new THREE.Mesh(
        medium
          ? createChamferedSlopedBoxGeometry(3.75, height, 3.8, 0.26, 0.45, 0.58)
          : new THREE.BoxGeometry(3.4, height * 0.9, 3.45),
        darkMaterial,
      );
      funnel.position.set(x, medium ? 10.85 : 10.65, 0);
      proxy.add(funnel);
      if (medium) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.27, 3.3), darkMaterial);
        cap.position.set(x, 10.85 + height * 0.5 + 0.08, 0);
        proxy.add(cap);
      }
    }
    for (const [x, base, top] of [[6.15, 11.55, 18.7], [-10.0, 10.35, 18.1]] as const) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(medium ? 0.13 : 0.24, medium ? 0.2 : 0.34, top - base, 6), darkMaterial);
      mast.position.set(x, (top + base) * 0.5, 0);
      proxy.add(mast);
      if (medium) {
        for (const side of [-1, 1])
          addStrut(proxy, new THREE.Vector3(x - 1.35, base, side * 1.45), new THREE.Vector3(x, top - 0.7, side * 0.25), 0.09, darkMaterial);
      }
    }
    const topSteerProxy = new THREE.Mesh(
      new THREE.BoxGeometry(medium ? 4.85 : 4.25, medium ? 1.25 : 0.88, 0.15),
      radarMaterial,
    );
    topSteerProxy.position.set(6.15, 18.7, 0);
    const topPairProxy = new THREE.Mesh(
      new THREE.BoxGeometry(medium ? 4.95 : 4.35, medium ? 2.12 : 1.55, 0.17),
      radarMaterial,
    );
    topPairProxy.position.set(-10.0, 18.1, 0);
    proxy.add(topSteerProxy, topPairProxy);
    if (medium) {
      const topSteerBack = topSteerProxy.clone();
      topSteerBack.position.z = 0.3;
      const topPairBack = topPairProxy.clone();
      topPairBack.position.z = 0.32;
      const steerFrame = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.09, 0.08), darkMaterial);
      steerFrame.position.set(6.15, 19.3, 0.23);
      const pairFrameTop = new THREE.Mesh(new THREE.BoxGeometry(5.15, 0.1, 0.08), darkMaterial);
      pairFrameTop.position.set(-10.0, 19.14, 0.24);
      const pairFrameBottom = pairFrameTop.clone();
      pairFrameBottom.position.y = 17.06;
      proxy.add(topSteerBack, topPairBack, steerFrame, pairFrameTop, pairFrameBottom);
    }

    const domePedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 1.2, medium ? 12 : 8), superMaterial);
    domePedestal.position.set(-24.75, 10.5, 0);
    const domeFace = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.25, 0.5, medium ? 16 : 8), radarMaterial);
    domeFace.rotation.z = Math.PI / 2;
    domeFace.position.set(-24.85, 12.25, 0);
    proxy.add(domePedestal, domeFace);
    if (medium) {
      const domeRim = new THREE.Mesh(new THREE.TorusGeometry(1.37, 0.08, 5, 20), darkMaterial);
      domeRim.rotation.y = Math.PI / 2;
      domeRim.position.copy(domeFace.position);
      proxy.add(domeRim);
    }

    for (const side of [-1, 1])
      for (let bank = 0; bank < 4; bank++) {
        const bankX = 12.4 - bank * 5.0;
        if (medium) {
          const cradle = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.3, 2.0), darkMaterial);
          cradle.rotation.z = bazaltElevation;
          cradle.rotation.y = -side * bazaltOutboardYaw;
          cradle.position.set(bankX - 0.2, 6.75, side * 4.22);
          proxy.add(cradle);
          for (let tier = 0; tier < 2; tier++) {
            const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.63, 5.45, 8), missileMaterial);
            canister.rotation.z = Math.PI / 2 + bazaltElevation;
            canister.rotation.y = -side * bazaltOutboardYaw;
            canister.position.set(bankX, 7.15 + tier * 0.44, side * (3.96 + tier * 0.66));
            proxy.add(canister);
          }
        } else {
          const pairedCanister = new THREE.Mesh(new THREE.BoxGeometry(5.45, 1.2, 1.42), missileMaterial);
          pairedCanister.rotation.z = bazaltElevation;
          pairedCanister.rotation.y = -side * bazaltOutboardYaw;
          pairedCanister.position.set(bankX, 7.48, side * 4.3);
          proxy.add(pairedCanister);
        }
      }

    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 4; column++) {
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, medium ? 12 : 7), darkMaterial);
        lid.position.set(-13.0 - column * 2.55, 6.0, (row === 0 ? -1 : 1) * 1.42);
        proxy.add(lid);
        if (medium) {
          const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.045, 4, 18), radarMaterial);
          lidRim.rotation.x = Math.PI / 2;
          lidRim.position.set(lid.position.x, 6.08, lid.position.z);
          proxy.add(lidRim);
        }
      }

    const gunProxy = new THREE.Mesh(
      medium ? slopedBox(3.5, 1.65, 3.05, 0.78, 0.3) : new THREE.BoxGeometry(3.2, 1.45, 2.75),
      superMaterial,
    );
    gunProxy.position.set(33.35, 8.0, 0);
    proxy.add(gunProxy);
    if (medium)
      for (const z of [-0.3, 0.3]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.5, 6), darkMaterial);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(36.35, 8.28, z);
        proxy.add(barrel);
      }
    return proxy;
  };
  const mediumDetail = createProxy(true), lowDetail = createProxy(false);
  mediumDetail.visible = false;
  lowDetail.visible = false;
  ship.add(highDetail, mediumDetail, lowDetail);
  registerAssetDetailLod(ship, { nearDistance: 270, mediumDistance: 340, high:[highDetail], medium:[mediumDetail], low:[lowDetail], exclusiveTiers:true, qualityAware:true });

  ship.userData.platformSlots = slots;
  ship.userData.hullMaterial = hullMaterial;
  ship.userData.hullLength = 83;
  ship.userData.hullBeam = 9.26;
  ship.userData.hullLengthBeamRatio = 83 / 9.26;
  ship.userData.highDetail = highDetail;
  ship.userData.mediumDetail = mediumDetail;
  ship.userData.lowDetail = lowDetail;
  ship.userData.detail = [forwardHouse, operationsDeck, bridgeDeck, bridge, mastDeck, machineryHouse, aftControlHouse, hangar, flightDeck, topDome, forwardMast, aftMast, ...slots.weaponHardpoints.map((hardpoint) => hardpoint.mount.parent!), ...slots.pointDefenseMounts.map((mount) => mount.traverse)];
  return ship;
}

export const MOSKVA = {
  id: "slava-moskva",
  name: "MOSKVA",
  className: "SLAVA CLASS / PROJECT 1164",
  nation: "USSR / RUSSIA",
  era: "1980s-2000s",
  role: "GUIDED MISSILE CRUISER / SURFACE STRIKE",
  defaultEmconMode: "active",
  passiveSensors: {
    esm: {
      id: "spectrum-esm",
      kind: "esm",
      range: 980,
      fieldOfViewDeg: 360,
      updateInterval: 1.4,
      bearingPrecisionDeg: 4.5,
      rangeEstimateError: 0.32,
      minimumSignal: 0.055,
      detects: ["aircraft", "ship", "missile"],
    },
  },
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
