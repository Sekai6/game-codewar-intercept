import * as THREE from "three";
import type { ShipDefinition } from "../ship-types";
import { applySurfaceDetail } from "../visual/material-textures";
import {
  createLoftedHullGeometry,
  createSheerDeckGeometry,
  createWaterlineBandGeometry,
  type HullStation,
} from "./hull-geometry";
import {
  addModelStrut as strut,
  createChamferedSlopedBoxGeometry,
  createGuardRailBeam,
  createHawsePipe,
  createLifeRaftCanister,
  createMk141Launcher,
  createShipBoat,
  createSlopedBoxGeometry as slopedBox,
  type ModelWeaponHardpoint,
} from "./model-primitives";
import {
  createMk41VlsBank,
  createMk45Gun,
  createPhalanxCiws,
  createSlq32Array,
  createSpg62Director,
  createSpy1Array,
  type VlsCell,
} from "./us-navy-equipment";

const TICONDEROGA_REAL_LENGTH_M = 172.8;
const TICONDEROGA_REAL_BEAM_M = 16.8;
const MODEL_METERS_PER_UNIT = 2.25;
const TICONDEROGA_LENGTH_SCALE =
  TICONDEROGA_REAL_LENGTH_M / MODEL_METERS_PER_UNIT / 68;
const TICONDEROGA_MODEL_BEAM = TICONDEROGA_REAL_BEAM_M / MODEL_METERS_PER_UNIT;
const longitudinal = (value: number) => value * TICONDEROGA_LENGTH_SCALE;
const TICONDEROGA_HULL: readonly HullStation[] = [
  // Spruance-derived fine bow, long parallel middle body and clipped transom.
  // Additional end stations keep the characteristic cruiser silhouette from
  // collapsing into a generic rectangular hull at oblique viewing angles.
  { x: longitudinal(-34), deckHalf: 2.72, shoulderHalf: 2.68, waterlineHalf: 2.48, keelHalf: 0.92, deckY: 5.48, shoulderY: 3.34, waterlineY: 0.38, keelY: -0.56 },
  { x: longitudinal(-33.1), deckHalf: 3.08, shoulderHalf: 3, waterlineHalf: 2.76, keelHalf: 1.02, deckY: 5.52, shoulderY: 3.28, waterlineY: 0.34, keelY: -0.66 },
  { x: longitudinal(-31), deckHalf: 3.38, shoulderHalf: 3.27, waterlineHalf: 2.98, keelHalf: 1.12, deckY: 5.58, shoulderY: 3.22, waterlineY: 0.31, keelY: -0.78 },
  { x: longitudinal(-27), deckHalf: 3.55, shoulderHalf: 3.42, waterlineHalf: 3.11, keelHalf: 1.18, deckY: 5.65, shoulderY: 3.18, waterlineY: 0.29, keelY: -0.86 },
  { x: longitudinal(-20), deckHalf: 3.66, shoulderHalf: 3.52, waterlineHalf: 3.16, keelHalf: 1.2, deckY: 5.74, shoulderY: 3.16, waterlineY: 0.28, keelY: -0.9 },
  { x: longitudinal(-8), deckHalf: 3.73, shoulderHalf: 3.58, waterlineHalf: 3.19, keelHalf: 1.2, deckY: 5.82, shoulderY: 3.16, waterlineY: 0.27, keelY: -0.94 },
  { x: longitudinal(6), deckHalf: 3.73, shoulderHalf: 3.58, waterlineHalf: 3.17, keelHalf: 1.18, deckY: 5.86, shoulderY: 3.18, waterlineY: 0.27, keelY: -0.94 },
  { x: longitudinal(14), deckHalf: 3.68, shoulderHalf: 3.52, waterlineHalf: 3.07, keelHalf: 1.12, deckY: 5.91, shoulderY: 3.24, waterlineY: 0.29, keelY: -0.88 },
  { x: longitudinal(18), deckHalf: 3.56, shoulderHalf: 3.4, waterlineHalf: 2.94, keelHalf: 1.02, deckY: 5.97, shoulderY: 3.34, waterlineY: 0.31, keelY: -0.78 },
  { x: longitudinal(22.5), deckHalf: 3.34, shoulderHalf: 3.12, waterlineHalf: 2.63, keelHalf: 0.88, deckY: 6.07, shoulderY: 3.5, waterlineY: 0.34, keelY: -0.66 },
  { x: longitudinal(26.5), deckHalf: 2.82, shoulderHalf: 2.54, waterlineHalf: 2.03, keelHalf: 0.64, deckY: 6.23, shoulderY: 3.75, waterlineY: 0.38, keelY: -0.48 },
  { x: longitudinal(29.5), deckHalf: 2.02, shoulderHalf: 1.7, waterlineHalf: 1.28, keelHalf: 0.38, deckY: 6.46, shoulderY: 4.06, waterlineY: 0.44, keelY: -0.22 },
  { x: longitudinal(31.8), deckHalf: 1.05, shoulderHalf: 0.82, waterlineHalf: 0.54, keelHalf: 0.16, deckY: 6.7, shoulderY: 4.36, waterlineY: 0.5, keelY: 0.04 },
  { x: longitudinal(33.1), deckHalf: 0.42, shoulderHalf: 0.31, waterlineHalf: 0.18, keelHalf: 0.05, deckY: 6.84, shoulderY: 4.57, waterlineY: 0.55, keelY: 0.2 },
  { x: longitudinal(34), deckHalf: 0.045, shoulderHalf: 0.035, waterlineHalf: 0.02, keelHalf: 0.008, deckY: 6.94, shoulderY: 4.75, waterlineY: 0.59, keelY: 0.36 },
];
function hullNumberTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f3f4ee";
  context.font = "700 58px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("57", 128, 51);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function flagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 247;
  canvas.height = 130;
  const context = canvas.getContext("2d")!;
  for (let row = 0; row < 13; row++) {
    context.fillStyle = row % 2 ? "#f4f3ed" : "#b22234";
    context.fillRect(0, row * 10, 247, 10);
  }
  context.fillStyle = "#3c3b6e";
  context.fillRect(0, 0, 99, 70);
  context.fillStyle = "#fff";
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 6; x++) {
      context.beginPath();
      context.arc(9 + x * 16 + (y % 2) * 8, 8 + y * 14, 1.8, 0, Math.PI * 2);
      context.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function buildTiconderoga() {
  // Ship-local axes: +X bow, -Z starboard, +Z port.
  const ship = new THREE.Group(),
    hullMat = new THREE.MeshStandardMaterial({
      color: 0x748183,
      metalness: 0.14,
      roughness: 0.5,
    }),
    deckMat = new THREE.MeshStandardMaterial({
      color: 0x5d6867,
      metalness: 0.1,
      roughness: 0.7,
    }),
    superMat = new THREE.MeshStandardMaterial({
      color: 0x8d9998,
      metalness: 0.16,
      roughness: 0.56,
    }),
    dark = new THREE.MeshStandardMaterial({
      color: 0x263235,
      metalness: 0.52,
      roughness: 0.46,
    }),
    arrayMat = new THREE.MeshStandardMaterial({
      color: 0xcbd0c8,
      metalness: 0.24,
      roughness: 0.58,
    }),
    sensorBorderMat = new THREE.MeshStandardMaterial({
      color: 0x657274,
      metalness: 0.12,
      roughness: 0.68,
    }),
    windowMat = new THREE.MeshStandardMaterial({
      color: 0x18363d,
      emissive: 0x092126,
      emissiveIntensity: 0.42,
      metalness: 0.22,
      roughness: 0.28,
    }),
    highDetail = new THREE.Group(),
    mediumDetail = new THREE.Group(),
    lowDetail = new THREE.Group();
  applySurfaceDetail(hullMat, "painted-metal", 0.3);
  applySurfaceDetail(deckMat, "weather-deck", 0.5);
  applySurfaceDetail(superMat, "painted-metal", 0.26);
  applySurfaceDetail(dark, "dark-metal", 0.34);
  applySurfaceDetail(arrayMat, "painted-metal", 0.2);
  applySurfaceDetail(sensorBorderMat, "painted-metal", 0.24);
  const hull = new THREE.Mesh(createLoftedHullGeometry(TICONDEROGA_HULL), hullMat),
    waterline = new THREE.Mesh(
      createWaterlineBandGeometry(TICONDEROGA_HULL),
      new THREE.MeshStandardMaterial({ color: 0x151d20, roughness: 0.8 }),
    );
  ship.add(hull, waterline);
  const deck = new THREE.Mesh(
    createSheerDeckGeometry(TICONDEROGA_HULL),
    deckMat,
  );
  ship.add(deck);
  // CG-57 retained the class' conspicuously tall, slab-sided AEGIS houses.
  // Keeping the forward and after houses as separate masses is more important
  // to the silhouette than adding generic surface clutter to one long wedge.
  const forwardHouse = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(13.2),
      7.55,
      6.55,
      0.24,
      longitudinal(1.85),
      longitudinal(0.32),
    ),
    superMat,
  );
  forwardHouse.position.set(longitudinal(6.9), 9.68, 0);
  const forwardHouseCap = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(8.8),
      0.42,
      6.05,
      0.16,
      longitudinal(0.72),
      longitudinal(0.22),
    ),
    deckMat,
  );
  forwardHouseCap.position.set(longitudinal(7.7), 13.55, 0);
  const bridge = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(7.8),
      3.15,
      5.82,
      0.26,
      longitudinal(1.45),
      longitudinal(0.32),
    ),
    superMat,
  );
  bridge.position.set(longitudinal(9.35), 15.15, 0);
  const bridgeRoof = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(6.25),
      0.52,
      5.18,
      0.18,
      longitudinal(0.52),
      longitudinal(0.18),
    ),
    dark,
  );
  bridgeRoof.position.set(longitudinal(8.55), 16.96, 0);
  ship.add(forwardHouse, forwardHouseCap, bridge, bridgeRoof);
  for (const side of [-1, 1])
    for (let x = 6.7; x <= 11.7; x += 0.82) {
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.42, 0.1),
        windowMat,
      );
      window.position.set(longitudinal(x), 15.55, side * 2.94);
      highDetail.add(window);
    }
  for (let z = -2.15; z <= 2.15; z += 0.72) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.42, 0.48),
      windowMat,
    );
    window.position.set(longitudinal(12.4), 15.55, z);
    highDetail.add(window);
  }
  for (const side of [-1, 1]) {
    const windowBrow = new THREE.Mesh(
      createChamferedSlopedBoxGeometry(longitudinal(6.2), 0.18, 0.24, 0.06, longitudinal(0.45), longitudinal(0.15)),
      dark,
    );
    windowBrow.position.set(longitudinal(9.15), 15.88, side * 3.0);
    highDetail.add(windowBrow);
  }
  for (const side of [-1, 1]) {
    const bridgeWing = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(3.1), 0.32, 1.15),
      superMat,
    );
    bridgeWing.position.set(longitudinal(9.8), 14.35, side * 3.23);
    const bulwark = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(3.25), 0.48, 0.09),
      superMat,
    );
    bulwark.position.set(longitudinal(9.8), 14.72, side * 3.77);
    highDetail.add(bridgeWing, bulwark);
  }
  const aftHouse = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(9.8),
      6.75,
      6.42,
      0.24,
      longitudinal(0.38),
      longitudinal(1.1),
    ),
    superMat,
  );
  aftHouse.position.set(longitudinal(-7.8), 9.35, 0);
  const aftUpperHouse = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(6.2),
      2.75,
      5.82,
      0.2,
      longitudinal(0.3),
      longitudinal(0.68),
    ),
    superMat,
  );
  aftUpperHouse.position.set(longitudinal(-9.0), 14.08, 0);
  const aftHouseCap = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(5.7),
      0.34,
      5.25,
      0.14,
      longitudinal(0.22),
      longitudinal(0.42),
    ),
    deckMat,
  );
  aftHouseCap.position.set(longitudinal(-9.05), 15.62, 0);
  ship.add(aftHouse, aftUpperHouse, aftHouseCap);
  const hangar = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(7.8),
      4.35,
      6.3,
      0.2,
      longitudinal(0.2),
      longitudinal(0.55),
    ),
    superMat,
  );
  hangar.position.set(longitudinal(-14.75), 8.12, 0);
  const hangarRoof = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(7.5), 0.18, 6.18),
    deckMat,
  );
  hangarRoof.position.set(longitudinal(-14.7), 10.38, 0);
  ship.add(hangar, hangarRoof);
  const hangarDoors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    // The two helicopter bays open aft onto the central flight deck rather
    // than reading as generic black openings in the ship's side.
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.7, 2.48),
      dark,
    );
    door.position.set(longitudinal(-18.7), 7.92, side * 1.42);
    highDetail.add(door);
    hangarDoors.push(door);
    for (let y = 6.82; y <= 9.02; y += 0.55) {
      const doorSeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.045, 2.34),
        sensorBorderMat,
      );
      doorSeam.position.set(longitudinal(-18.77), y, side * 1.42);
      highDetail.add(doorSeam);
      hangarDoors.push(doorSeam);
    }
    const catwalk = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(10.8), 0.18, 0.76),
      dark,
    );
    catwalk.position.set(longitudinal(-9.2), 11.02, side * 3.52);
    highDetail.add(catwalk);
  }
  const arrays: THREE.Group[] = [];
  arrays.push(
    createSpy1Array(
      arrayMat,
      sensorBorderMat,
      new THREE.Vector3(longitudinal(12.2), 11.55, 0),
      new THREE.Euler(0, Math.PI / 2, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      sensorBorderMat,
      new THREE.Vector3(longitudinal(5.65), 11.5, -3.3),
      new THREE.Euler(0, Math.PI, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      sensorBorderMat,
      new THREE.Vector3(longitudinal(-11.82), 14.08, 0),
      new THREE.Euler(0, -Math.PI / 2, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      sensorBorderMat,
      new THREE.Vector3(longitudinal(-9.0), 14.08, 2.94),
      new THREE.Euler(0, 0, 0),
    ),
  );
  arrays.forEach((array) => array.scale.setScalar(0.43));
  ship.add(...arrays);
  const platingMat = new THREE.MeshStandardMaterial({ color: 0x445255, metalness: 0.08, roughness: 0.76 });
  for (const side of [-1, 1]) {
    for (const x of [-29, -23, -17, -11, -5, 1, 7, 13, 19, 25]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.4, 0.025), platingMat);
      seam.position.set(longitudinal(x), 4.12, side * 3.55);
      highDetail.add(seam);
    }
    for (const x of [-26, -20, -14, -8, -2, 4, 10, 16, 22]) {
      const scupper = new THREE.Mesh(new THREE.BoxGeometry(longitudinal(0.5), 0.14, 0.04), dark);
      scupper.position.set(longitudinal(x), 5.28, side * 3.66);
      highDetail.add(scupper);
    }
  }
  const exhaustUptakes: THREE.Object3D[] = [];
  for (const rawX of [0.25, -6.1]) {
    const uptakeGroup = new THREE.Group();
    uptakeGroup.position.x = longitudinal(rawX);
    const trunk = new THREE.Mesh(
      slopedBox(3.05, 3.25, 3.35, 0.28, 0.28),
      superMat,
    );
    trunk.position.y = 14.15;
    uptakeGroup.add(trunk);
    // The class has two distinct rectangular uptake pairs. Cylindrical stacks
    // made the old model read like a generic frigate from every side view.
    for (const z of [-0.68, 0.68]) {
      const stack = new THREE.Mesh(
        createChamferedSlopedBoxGeometry(0.82, 2.35, 0.76, 0.1, 0.07, 0.07),
        dark,
      );
      stack.position.set(0, 16.82, z);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.16, 0.66),
        new THREE.MeshBasicMaterial({ color: 0x101618 }),
      );
      cap.position.set(0, 18.06, z);
      uptakeGroup.add(stack, cap);
    }
    for (const side of [-1, 1])
      for (let y = 13.35; y <= 14.85; y += 0.5) {
        const louver = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.055, 0.045),
          dark,
        );
        louver.position.set(0, y, side * 1.69);
        uptakeGroup.add(louver);
      }
    exhaustUptakes.push(uptakeGroup);
    ship.add(uptakeGroup);
  }
  const foreMast = new THREE.Group();
  foreMast.position.set(longitudinal(3.65), 15.15, 0);
  for (const side of [-1, 1])
    strut(
      foreMast,
      new THREE.Vector3(-1.05, 0, side * 1.62),
      new THREE.Vector3(0, 8.9, side * 0.38),
      0.12,
      dark,
    );
  strut(
    foreMast,
    new THREE.Vector3(1.15, 0, 0),
    new THREE.Vector3(0, 8.9, 0),
    0.12,
    dark,
  );
  for (let y = 1.7; y < 8.5; y += 1.7) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 3.05 - y * 0.2),
      dark,
    );
    bar.position.y = y;
    foreMast.add(bar);
    for (const side of [-1, 1]) {
      strut(
        foreMast,
        new THREE.Vector3(-0.72, y - 0.7, side * (1.5 - y * 0.12)),
        new THREE.Vector3(0.54, y + 0.75, side * (1.28 - y * 0.11)),
        0.045,
        dark,
      );
      strut(
        foreMast,
        new THREE.Vector3(0.54, y - 0.7, side * (1.38 - y * 0.11)),
        new THREE.Vector3(-0.72, y + 0.75, side * (1.18 - y * 0.1)),
        0.045,
        dark,
      );
    }
  }
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.92, 0.24, 10),
    dark,
  );
  platform.position.y = 7.85;
  foreMast.add(platform);
  const mastPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.2, 6.8, 7),
    dark,
  );
  mastPole.position.y = 12.15;
  foreMast.add(mastPole);
  const sps49 = new THREE.Group();
  sps49.position.y = 9.45;
  const radarFrame = new THREE.Group();
  for (const y of [-0.88, 0.88]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(6.35, 0.065, 0.07),
      arrayMat,
    );
    rail.position.y = y;
    radarFrame.add(rail);
  }
  for (let x = -3.05; x <= 3.05; x += 0.42) {
    const tine = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 1.76, 0.055),
      arrayMat,
    );
    tine.position.x = x;
    radarFrame.add(tine);
  }
  const radarYoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 1.1),
    dark,
  );
  radarYoke.position.y = -1.12;
  sps49.add(radarFrame, radarYoke);
  foreMast.add(sps49);
  for (const [y, width] of [[5.5, 4.6], [11.7, 6.1], [14.4, 4.1]] as const) {
    const yard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, width), dark);
    yard.position.y = y;
    foreMast.add(yard);
  }
  for (const [y, radius] of [[12.35, 0.42], [15.0, 0.27]] as const) {
    const radome = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), superMat);
    radome.position.y = y;
    foreMast.add(radome);
  }
  ship.add(foreMast);
  const aftMast = new THREE.Group();
  aftMast.position.set(longitudinal(-10.45), 14.4, 0);
  for (const side of [-1, 1])
    strut(
      aftMast,
      new THREE.Vector3(-0.95, 0, side * 1.42),
      new THREE.Vector3(0, 7.6, side * 0.34),
      0.11,
      dark,
    );
  strut(
    aftMast,
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 7.6, 0),
    0.11,
    dark,
  );
  const aftPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.18, 5.8, 7),
    dark,
  );
  aftPole.position.y = 10.25;
  const aftPlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.42, 0.22, 10),
    dark,
  );
  aftPlatform.position.y = 6.8;
  const aftYard = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 5),
    dark,
  );
  aftYard.position.y = 10.15;
  const surfaceRadar = new THREE.Group();
  surfaceRadar.position.y = 7.7;
  const surfaceRadarPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.68, 0.07),
    arrayMat,
  );
  const surfaceRadarYoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.42, 0.65),
    dark,
  );
  surfaceRadarYoke.position.y = -0.45;
  surfaceRadar.add(surfaceRadarPanel, surfaceRadarYoke);
  for (let y = 1.2; y < 6.7; y += 1.45)
    for (const side of [-1, 1])
      strut(
        aftMast,
        new THREE.Vector3(-0.62, y - 0.55, side * (1.28 - y * 0.12)),
        new THREE.Vector3(0.48, y + 0.65, side * (1.08 - y * 0.1)),
        0.042,
        dark,
      );
  aftMast.add(aftPole, aftPlatform, aftYard, surfaceRadar);
  ship.add(aftMast);
  const forwardVls = createMk41VlsBank(8, 8, 0.72, superMat, dark, [0, 1, 8]);
  forwardVls.position.set(longitudinal(21.4), 6.02, 0);
  forwardVls.scale.setScalar(0.74);
  const aftVls = createMk41VlsBank(8, 8, 0.72, superMat, dark, [55, 62, 63]);
  aftVls.position.set(longitudinal(-25.2), 5.96, 0);
  aftVls.scale.setScalar(0.74);
  ship.add(forwardVls, aftVls);
  const vlsCells = [
    ...(forwardVls.userData.cells as VlsCell[]).map((cell) => ({
      ...cell,
      bank: "FWD",
    })),
    ...(aftVls.userData.cells as VlsCell[]).map((cell) => ({
      ...cell,
      bank: "AFT",
    })),
  ];
  const foreGun = createMk45Gun(superMat, dark);
  foreGun.position.set(longitudinal(29.15), 6.32, 0);
  foreGun.scale.setScalar(0.72);
  const aftGun = createMk45Gun(superMat, dark);
  aftGun.position.set(longitudinal(-31), 6.18, 0);
  aftGun.rotation.y = Math.PI;
  aftGun.scale.setScalar(0.72);
  ship.add(foreGun, aftGun);
  const directors = [
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(10.35), 17.45, -2.05),
      -0.42,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(10.35), 17.45, 2.05),
      0.42,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-10.65), 16.13, -2.1),
      Math.PI + 0.44,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-10.65), 16.13, 2.1),
      Math.PI - 0.44,
    ),
  ];
  directors.forEach((director) => director.scale.setScalar(0.68));
  ship.add(...directors);
  const foreCiws = createPhalanxCiws(superMat, dark, "ciwsFore");
  foreCiws.position.set(longitudinal(13.5), 9.3, 0);
  foreCiws.scale.setScalar(0.82);
  const aftCiws = createPhalanxCiws(superMat, dark, "ciwsAft");
  aftCiws.position.set(longitudinal(-15.5), 10.2, -3.55);
  aftCiws.rotation.y = Math.PI;
  aftCiws.scale.setScalar(0.82);
  ship.add(foreCiws, aftCiws);
  const flightDeck = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(8.8), 0.14, 6.35),
    deckMat,
  );
  flightDeck.position.set(longitudinal(-19.5), 6.05, 0);
  ship.add(flightDeck);
  const marking = new THREE.Mesh(
    new THREE.RingGeometry(2.05, 2.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8e4cb, side: THREE.DoubleSide }),
  );
  marking.rotation.x = -Math.PI / 2;
  marking.position.set(longitudinal(-19.5), 6.14, 0);
  highDetail.add(marking);
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(8.15), 0.025, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xe8e4cb }),
    );
    line.position.set(longitudinal(-19.5), 6.15, side * 2.75);
    highDetail.add(line);
  }
  for (const side of [-1, 1])
    for (let x = -28; x <= 28; x += 2.5) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.65, 5),
        dark,
      );
      post.position.set(
        longitudinal(x),
        6.45,
        side * (x > 20 ? 3.2 : x < -25 ? 3.2 : 3.72),
      );
      highDetail.add(post);
    }
  for (const side of [-1, 1]) {
    const boat = createShipBoat(
      0.48,
      3.25,
      new THREE.MeshStandardMaterial({ color: 0xd9d6c9, roughness: 0.68 }),
    );
    boat.position.set(longitudinal(-5.8), 9.05, side * 3.92);
    boat.rotation.y = side > 0 ? 0.05 : -0.05;
    highDetail.add(boat);
  }
  for (const side of [-1, 1]) {
    const boatBay = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(6.2), 2.05, 0.18),
      dark,
    );
    boatBay.position.set(longitudinal(-5.8), 8.85, side * 3.61);
    highDetail.add(boatBay);
    for (const x of [-8.3, -3.3]) {
      const davit = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.055, 6, 14, Math.PI),
        dark,
      );
      davit.rotation.x = side > 0 ? 0 : Math.PI;
      davit.position.set(longitudinal(x), 9.75, side * 3.9);
      highDetail.add(davit);
    }
  }
  for (const side of [-1, 1])
    for (const x of [-15, -4, 7, 15]) {
      const canister = createLifeRaftCanister(
        0.28,
        1.75,
        new THREE.MeshStandardMaterial({ color: 0xd4d8cf, roughness: 0.7 }),
      );
      canister.position.set(longitudinal(x), 8.2, side * 4);
      highDetail.add(canister);
    }
  const surfaceStrikeHardpoints: ModelWeaponHardpoint[] = [],
    surfaceStrikeLaunchers: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const harpoon = createMk141Launcher(
      superMat,
      dark,
      `mk141-${side > 0 ? "port" : "starboard"}`,
    );
    harpoon.position.set(longitudinal(-2.2), 7.18, side * 2.05);
    // Cant each bank outboard instead of across the ship's centreline.
    harpoon.rotation.y = -side * 0.42;
    harpoon.scale.setScalar(0.7);
    surfaceStrikeHardpoints.push(
      ...(harpoon.userData.weaponHardpoints as ModelWeaponHardpoint[]),
    );
    surfaceStrikeLaunchers.push(harpoon);
    ship.add(harpoon);
    const ewArray = createSlq32Array(arrayMat, dark);
    ewArray.position.set(longitudinal(1.8), 13.2, side * 3.38);
    ewArray.rotation.y = side > 0 ? 0 : Math.PI;
    highDetail.add(ewArray);
  }
  for (const side of [-1, 1]) {
    const platingSeam = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(49), 0.045, 0.045),
      dark,
    );
    platingSeam.position.set(longitudinal(-2), 2.35, side * 3.21);
    highDetail.add(platingSeam);
    const hawse = createHawsePipe(0.38, 0.11, dark);
    hawse.position.set(longitudinal(28.4), 3.65, side * 2.36);
    highDetail.add(hawse);
    const anchor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.35, 7),
      dark,
    );
    anchor.position.set(longitudinal(29), 3.25, side * 2.48);
    anchor.rotation.z = 0.62;
    highDetail.add(anchor);
  }
  const breakwater = new THREE.Group();
  const breakwaterFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.05, 5.15),
    superMat,
  );
  breakwaterFace.rotation.z = -0.16;
  breakwaterFace.position.set(longitudinal(24.9), 6.55, 0);
  breakwater.add(breakwaterFace);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(2.8), 0.72, 0.13),
      superMat,
    );
    wing.position.set(longitudinal(23.65), 6.42, side * 2.35);
    wing.rotation.y = side * 0.42;
    breakwater.add(wing);
    for (const x of [longitudinal(26.7), longitudinal(-29)]) {
      const bitt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.55, 8),
        dark,
      );
      bitt.position.set(x, x > 0 ? 6.75 : 6.05, side * 1.45);
      breakwater.add(bitt);
    }
  }
  highDetail.add(breakwater);
  const rastTrack = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(10.5), 0.025, 0.09),
    new THREE.MeshBasicMaterial({ color: 0xe8e4cb }),
  );
  rastTrack.position.set(longitudinal(-19.5), 6.17, 0);
  highDetail.add(rastTrack);
  const smokePuffs: THREE.Mesh[] = [],
    smokeOrigins = [
      new THREE.Vector3(longitudinal(0.25), 18.15, -0.68),
      new THREE.Vector3(longitudinal(0.25), 18.15, 0.68),
      new THREE.Vector3(longitudinal(-6.1), 18.15, -0.68),
      new THREE.Vector3(longitudinal(-6.1), 18.15, 0.68),
    ];
  for (let n = 0; n < 12; n++) {
    const anchor = new THREE.Group(),
      origin = smokeOrigins[n % smokeOrigins.length],
      puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 7, 5),
        new THREE.MeshBasicMaterial({
          color: 0x526064,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
    anchor.position.copy(origin).sub(new THREE.Vector3(-4, 15, 0));
    // Cancels the anchor offset until either the flagship or fleet runtime animates it.
    puff.position.set(-4, 15, 0);
    anchor.add(puff);
    smokePuffs.push(puff);
    highDetail.add(anchor);
  }
  const flagGeometry = new THREE.PlaneGeometry(3, 1.6, 10, 3);
  flagGeometry.translate(-1.5, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      map: flagTexture(),
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(longitudinal(-10.45), 25, 0);
  highDetail.add(flag);
  ship.add(highDetail);
  for (const side of [-1, 1]) {
    const rail = createGuardRailBeam(
      longitudinal(48),
      0.07,
      new THREE.MeshBasicMaterial({ color: 0x82908d }),
    );
    rail.position.set(longitudinal(-1), 6.65, side * 3.72);
    mediumDetail.add(rail);
  }
  ship.add(mediumDetail);
  const lowForwardHouse = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(12.8),
      7.35,
      6.4,
      0.2,
      longitudinal(1.55),
      longitudinal(0.25),
    ),
    superMat,
  );
  lowForwardHouse.position.set(longitudinal(6.85), 9.65, 0);
  const lowBridge = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(7.4),
      3,
      5.6,
      0.2,
      longitudinal(1.2),
      longitudinal(0.25),
    ),
    superMat,
  );
  lowBridge.position.set(longitudinal(9.25), 15.05, 0);
  const lowAftHouse = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(9.5),
      6.55,
      6.2,
      0.2,
      longitudinal(0.3),
      longitudinal(0.85),
    ),
    superMat,
  );
  lowAftHouse.position.set(longitudinal(-7.8), 9.3, 0);
  const lowHangar = new THREE.Mesh(
    createChamferedSlopedBoxGeometry(
      longitudinal(7.5),
      4.15,
      6.15,
      0.18,
      longitudinal(0.16),
      longitudinal(0.42),
    ),
    superMat,
  );
  lowHangar.position.set(longitudinal(-14.7), 8.08, 0);
  const lowForeMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.4, 14, 6),
    dark,
  );
  lowForeMast.position.set(longitudinal(3.65), 22.1, 0);
  const lowAftMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.36, 11.5, 6),
    dark,
  );
  lowAftMast.position.set(longitudinal(-10.45), 20.2, 0);

  // The operational Mk 41 groups are hidden at Standard quality together
  // with the rest of `detail`.  Supply visual-only banks at the exact same
  // deck coordinates so low LOD never makes the cruiser's VLS disappear.
  // These meshes deliberately carry no cell metadata or launcher handles.
  const createLowVlsBank = (rawX: number, y: number) => {
    const bank = new THREE.Group();
    bank.position.set(longitudinal(rawX), y, 0);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(4.55), 0.18, 4.55),
      superMat,
    );
    base.position.y = 0.09;
    bank.add(base);
    const lidGeometry = new THREE.BoxGeometry(
      longitudinal(0.42),
      0.075,
      0.42,
    );
    const lids = new THREE.InstancedMesh(lidGeometry, dark, 64);
    const cellTransform = new THREE.Matrix4();
    let cellIndex = 0;
    for (let row = 0; row < 8; row++)
      for (let column = 0; column < 8; column++) {
        cellTransform.makeTranslation(
          longitudinal((column - 3.5) * 0.52),
          0.22,
          (row - 3.5) * 0.52,
        );
        lids.setMatrixAt(cellIndex++, cellTransform);
      }
    lids.instanceMatrix.needsUpdate = true;
    bank.add(lids);
    return bank;
  };
  const lowForwardVls = createLowVlsBank(21.4, 6.02);
  const lowAftVls = createLowVlsBank(-25.2, 5.96);
  lowDetail.add(
    lowForwardHouse,
    lowBridge,
    lowAftHouse,
    lowHangar,
    lowForeMast,
    lowAftMast,
    lowForwardVls,
    lowAftVls,
  );
  for (const rawX of [0.25, -6.1]) {
    const lowUptake = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 4.55, 2.45),
      dark,
    );
    lowUptake.position.set(longitudinal(rawX), 15.8, 0);
    lowDetail.add(lowUptake);
  }
  lowDetail.visible = false;
  ship.add(lowDetail);
  const numberMaterial = new THREE.MeshBasicMaterial({
    map: hullNumberTexture(),
    transparent: true,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.35),
      numberMaterial,
    );
    number.position.set(longitudinal(23), 3.6, side * 3.02);
    number.rotation.y = side > 0 ? 0 : Math.PI;
    ship.add(number);
  }
  const navigationLights: THREE.PointLight[] = [],
    lightBulbs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const color = side < 0 ? 0x42ff74 : 0xff493e,
      light = new THREE.PointLight(color, 3, 18),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
    light.position.set(longitudinal(10.5), 17, side * 3.7);
    bulb.position.copy(light.position);
    strut(
      ship,
      new THREE.Vector3(longitudinal(10.5), 16.82, side * 2.55),
      bulb.position,
      0.06,
      dark,
    );
    navigationLights.push(light);
    lightBulbs.push(bulb);
    ship.add(light, bulb);
  }
  const mastLight = new THREE.PointLight(0xf5fff0, 2.5, 24),
    mastBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf5fff0 }),
    );
  mastLight.position.set(longitudinal(3.65), 30.1, 0);
  mastBulb.position.copy(mastLight.position);
  navigationLights.push(mastLight);
  lightBulbs.push(mastBulb);
  ship.add(mastLight, mastBulb);
  const radar = new THREE.Group();
  radar.userData.static = true;
  const searchBeam = new THREE.Mesh(
    new THREE.RingGeometry(25, 105, 64, 1, 0, Math.PI * 0.13),
    new THREE.MeshBasicMaterial({
      color: 0x5ee9df,
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  searchBeam.rotation.x = -Math.PI / 2;
  searchBeam.position.set(longitudinal(4), 18, 0);
  searchBeam.userData.temporalReactive = true;
  radar.add(searchBeam);
  radar.userData.searchBeam = searchBeam;
  ship.add(radar);
  const fireControl = new THREE.Group();
  fireControl.userData.static = true;
  ship.add(fireControl);
  const ewPulse = new THREE.Group();
  for (let n = 0; n < 3; n++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12 + n * 8, 0.08, 6, 72),
      new THREE.MeshBasicMaterial({
        color: 0x66e5dc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 18;
    ewPulse.add(ring);
  }
  ewPulse.visible = false;
  ship.add(ewPulse);
  ship.userData = {
    shipClass: "ticonderoga",
    hullStations: TICONDEROGA_HULL.length,
    hullSectionPoints: 8,
    hullLength: longitudinal(68),
    hullBeam: TICONDEROGA_MODEL_BEAM,
    hullLengthBeamRatio: longitudinal(68) / TICONDEROGA_MODEL_BEAM,
    realLengthMeters: TICONDEROGA_REAL_LENGTH_M,
    realBeamMeters: TICONDEROGA_REAL_BEAM_M,
    modelMetersPerUnit: MODEL_METERS_PER_UNIT,
    surfaceStrikeHardpoints,
    vlsCells,
    radar,
    secondaryRadar: sps49,
    fireControl,
    directors,
    sensorFaceModels: arrays,
    fixedSensorFaceHealth: [1, 1, 1, 1],
    highDetail,
    mediumDetail,
    lowDetail,
    smokePuffs,
    hangarDoors,
    flag,
    hullMat,
    ewPulse,
    navigationLights,
    lightBulbs,
    detail: [
      forwardHouse,
      forwardHouseCap,
      bridge,
      bridgeRoof,
      aftHouse,
      aftUpperHouse,
      aftHouseCap,
      hangar,
      hangarRoof,
      foreMast,
      aftMast,
      ...exhaustUptakes,
      forwardVls,
      aftVls,
      foreGun,
      aftGun,
      foreCiws,
      aftCiws,
      rastTrack,
      breakwater,
      ...surfaceStrikeLaunchers,
      ...directors,
      ...arrays,
    ],
  };
  return ship;
}

export const TICONDEROGA_METADATA: Omit<ShipDefinition, "build"> = {
  id: "ticonderoga",
  name: "USS LAKE CHAMPLAIN",
  hullNumber: "CG-57",
  era: "1990s AEGIS",
  role: "AEGIS AIR DEFENSE CRUISER",
  platform: {
    maxSpeedKnots: 32.5,
    cruiseSpeedKnots: 22,
    patrolSpeedKnots: 12,
    accelerationKnotsPerSecond: 1.75,
    decelerationKnotsPerSecond: 1.25,
    turnRateDeg: 1.8,
    decisionInterval: 1,
    standoffRange: 560,
    standoffTolerance: 60,
    significantHeightMeters: 32,
    radarRcs: 10.5,
  },
  hullColor: 0x748183,
  surfaceStrike: {
    weapon: "RGM-84 Harpoon",
    displayName: "2 x MK 141 QUAD HARPOON",
    magazine: 8,
    minimumInterval: 1.4,
    minRange: 35,
    maxRange: 720,
    requiredTrackQuality: 0.58,
    maximumTrackAge: 4,
    minimumTrackAge: 2.2,
    fireControlDelay: 1.6,
    passiveTargeting: {
      minimumTrackQuality: 0.18,
      minimumTrackAge: 5,
      fireControlDelay: 2,
      maximumUncertainty: 190,
    },
    datalinkUpdateInterval: 2.4,
    datalinkLatency: 0.4,
    datalinkMinimumQuality: 0.18,
    routeLateralOffset: 38,
    routeJoinRange: 210,
    arrivalWindow: 2,
    maximumSpeedCompensation: 0.24,
    damage: 34,
    fuseDelay: 0.32,
    salvoSize: 4,
    minimumSalvoSize: 2,
    maximumWeaponsInFlight: 4,
    assessmentDelay: 3,
    expectedLeakProbability: 0.46,
    targetHullEstimate: 100,
  },
  launcher: {
    kind: "mk41",
    displayName: "MK 41 VLS",
    compatibleWeapons: ["SM-2MR", "SM-2ER"],
    columns: 8,
    sequenceInterval: 0.5,
    exhaustClearance: 1.6,
    isolationStartsAt: 0.75,
    maximumIsolationFraction: 0.48,
    loadingPermutation: 17,
    gridSize: 64,
  },
  fixedSensorFaces: {
    sensorName: "AN/SPY-1B",
    subsystemId: "primaryRadar",
    labels: ["BOW", "STARBOARD", "STERN", "PORT"],
    headings: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
    damageMultiplier: 1.45,
    healthyColor: 0xcbd0c8,
    damagedColor: 0x4a302c,
    criticalEmissive: 0x45120c,
  },
  sensors: [
    {
      name: "AN/SPY-1B",
      threeDimensional: true,
      baseInterval: 0.42,
      maxRange: 820,
      radarHeight: 32,
      precision: 1.12,
      scanMode: "phased-array",
    },
    {
      name: "AN/SPS-49",
      threeDimensional: false,
      baseInterval: 1.05,
      maxRange: 1100,
      radarHeight: 38,
      precision: 0.75,
      scanMode: "mechanical",
    },
  ],
  subsystemLabels: {
    primaryRadar: "AN/SPY-1B",
    secondaryRadar: "AN/SPS-49",
    fireControl: "AN/SPG-62",
    aftLauncher: "MK 41 AFT",
    forwardLauncher: "MK 41 FWD",
    ciws: "PHALANX CIWS",
    ecm: "AN/SLQ-32",
    srboc: "MK 36 SRBOC",
    propulsion: "PROPULSION",
  },
  subsystemPositions: {
    primaryRadar: new THREE.Vector3(longitudinal(7), 13, 0),
    secondaryRadar: new THREE.Vector3(longitudinal(4), 25, 0),
    fireControl: new THREE.Vector3(longitudinal(10), 14, 0),
    aftLauncher: new THREE.Vector3(longitudinal(-25), 6, 0),
    forwardLauncher: new THREE.Vector3(longitudinal(22), 6, 0),
    ciws: new THREE.Vector3(longitudinal(13), 10, 0),
    ecm: new THREE.Vector3(longitudinal(-2), 15, 4),
    srboc: new THREE.Vector3(longitudinal(-5), 8, 4),
    propulsion: new THREE.Vector3(longitudinal(-7), 5, 0),
  },
  damageModel: {
    longitudinalLimit: longitudinal(30),
    zones: [
      { minX: longitudinal(18), systems: ["forwardLauncher", "ciws", "fireControl"] },
      { minX: longitudinal(6), systems: ["primaryRadar", "fireControl", "ecm", "ciws"] },
      {
        minX: longitudinal(-9),
        systems: ["fireControl", "ecm", "propulsion", "primaryRadar"],
      },
      {
        minX: longitudinal(-20),
        systems: ["secondaryRadar", "srboc", "propulsion", "fireControl"],
      },
      {
        minX: -Infinity,
        systems: ["aftLauncher", "srboc", "ciws", "secondaryRadar"],
      },
    ],
  },
  ammo: {
    rim67: 0,
    sm2mr: 48,
    sm2er: 32,
    ciws: 1800,
    channels: 6,
    illuminators: 4,
  },
  electronicWarfare: {
    ecmStrength: 0.64,
    burnThroughRange: 70,
    decoyRounds: 12,
    decoyCooldownSeconds: 2.2,
    decoyDeployRange: 92,
    decoyRcs: 8.5,
    decoyLifeSeconds: 14,
  },
  ciws: {
    mounts: [
      { objectName: "ciwsFore", label: "FORE", centerBearingDeg: 90, arcDeg: 210 },
      { objectName: "ciwsAft", label: "AFT", centerBearingDeg: -90, arcDeg: 210 },
    ],
    maximumRange: 15,
    minimumClosingSpeed: 0.5,
    minimumTti: 0.35,
    burstRounds: 60,
    cooldownSeconds: 0.55,
    traverseRateDeg: 70,
    firingToleranceDeg: 12,
    basePk: 0.46,
    maximumPk: 0.72,
    damage: 42,
  },
};
