import * as THREE from "three";
import { applySurfaceDetail } from "../visual/material-textures";
import {
  createLoftedHullGeometry,
  createSheerDeckGeometry,
  createWaterlineBandGeometry,
  type HullStation,
} from "./hull-geometry";
import {
  addModelStrut as addStrut,
  createChamferedBoxGeometry,
  createGuardRailBeam,
  createHawsePipe,
  createMk141Launcher,
  createShipBoat,
  createSlopedBoxGeometry,
  type ModelWeaponHardpoint,
} from "./model-primitives";

// Keep the established 59.5-unit gameplay length, but derive the beam from
// the real 219.8 m x 22.3 m proportions.  The original mesh was almost 30%
// too broad (L/B 7.73 instead of 9.86), which made the cruiser read as a
// short destroyer in oblique views.
const LONG_BEACH_REAL_LENGTH_M = 219.8;
const LONG_BEACH_REAL_BEAM_M = 22.3;
const LONG_BEACH_MODEL_LENGTH = 59.5;
const LONG_BEACH_MODEL_BEAM =
  LONG_BEACH_MODEL_LENGTH / (LONG_BEACH_REAL_LENGTH_M / LONG_BEACH_REAL_BEAM_M);
const LONG_BEACH_HALF_BEAM = LONG_BEACH_MODEL_BEAM / 2;
// The legacy model used the same vertical unit scale as its much shorter
// hull.  Once the real L/B ratio was restored, that left the deckhouse and
// mast roughly 50% too tall in beam views.  Preserve all local hardpoint and
// animation geometry, but use the ship's measured side-profile proportions
// for the assembled model.
const LONG_BEACH_VERTICAL_SCALE = 0.66;

// Late-1980s NTU hull: broad transom/flight deck, nearly parallel mid-body,
// pronounced forecastle sheer and a fine flared bow.  +X is forward.
const LONG_BEACH_HULL: readonly HullStation[] = [
  { x: -30, deckHalf: 2.58, shoulderHalf: 2.48, waterlineHalf: 2.18, keelHalf: 0.7, deckY: 5.7, shoulderY: 3.48, waterlineY: 0.34, keelY: -0.72 },
  { x: -28.6, deckHalf: 2.82, shoulderHalf: 2.7, waterlineHalf: 2.38, keelHalf: 0.8, deckY: 5.76, shoulderY: 3.44, waterlineY: 0.32, keelY: -0.8 },
  { x: -25, deckHalf: 2.98, shoulderHalf: 2.85, waterlineHalf: 2.52, keelHalf: 0.9, deckY: 5.84, shoulderY: 3.4, waterlineY: 0.3, keelY: -0.9 },
  { x: -18, deckHalf: LONG_BEACH_HALF_BEAM, shoulderHalf: 2.88, waterlineHalf: 2.56, keelHalf: 0.96, deckY: 5.94, shoulderY: 3.38, waterlineY: 0.28, keelY: -0.98 },
  { x: -7, deckHalf: LONG_BEACH_HALF_BEAM, shoulderHalf: 2.9, waterlineHalf: 2.58, keelHalf: 0.98, deckY: 6, shoulderY: 3.38, waterlineY: 0.28, keelY: -1 },
  { x: 5, deckHalf: LONG_BEACH_HALF_BEAM, shoulderHalf: 2.9, waterlineHalf: 2.57, keelHalf: 0.98, deckY: 6.04, shoulderY: 3.4, waterlineY: 0.28, keelY: -0.98 },
  { x: 14, deckHalf: 2.96, shoulderHalf: 2.82, waterlineHalf: 2.46, keelHalf: 0.92, deckY: 6.12, shoulderY: 3.48, waterlineY: 0.3, keelY: -0.92 },
  { x: 20, deckHalf: 2.72, shoulderHalf: 2.54, waterlineHalf: 2.18, keelHalf: 0.78, deckY: 6.26, shoulderY: 3.66, waterlineY: 0.34, keelY: -0.75 },
  { x: 24.2, deckHalf: 2.18, shoulderHalf: 1.96, waterlineHalf: 1.6, keelHalf: 0.53, deckY: 6.48, shoulderY: 3.98, waterlineY: 0.41, keelY: -0.47 },
  { x: 27.1, deckHalf: 1.2, shoulderHalf: 0.98, waterlineHalf: 0.63, keelHalf: 0.19, deckY: 6.76, shoulderY: 4.34, waterlineY: 0.49, keelY: -0.1 },
  { x: 28.8, deckHalf: 0.48, shoulderHalf: 0.35, waterlineHalf: 0.2, keelHalf: 0.06, deckY: 6.98, shoulderY: 4.66, waterlineY: 0.55, keelY: 0.18 },
  { x: 29.5, deckHalf: 0.045, shoulderHalf: 0.035, waterlineHalf: 0.02, keelHalf: 0.008, deckY: 7.14, shoulderY: 4.9, waterlineY: 0.6, keelY: 0.35 },
];
function createSectorGeometry(
  radius: number,
  halfAngle: number,
  segments = 24,
) {
  const vertices = [0, 0, 0],
    indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = -halfAngle + (halfAngle * 2 * i) / segments;
    vertices.push(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
  }
  for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function createHullNumberTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = "#e8ece5";
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("9", 64, 34);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createUSFlagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 247;
  canvas.height = 130;
  const ctx = canvas.getContext("2d")!;
  for (let stripe = 0; stripe < 13; stripe++) {
    ctx.fillStyle = stripe % 2 === 0 ? "#b22234" : "#f5f4ed";
    ctx.fillRect(0, stripe * 10, 247, 10);
  }
  ctx.fillStyle = "#3c3b6e";
  ctx.fillRect(0, 0, 99, 70);
  ctx.fillStyle = "#fff";
  for (let row = 0; row < 5; row++)
    for (let column = 0; column < 6; column++) {
      ctx.beginPath();
      ctx.arc(
        9 + column * 16 + (row % 2) * 8,
        8 + row * 14,
        1.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createMk10Launcher(deckMat: THREE.Material, darkMat: THREE.Material) {
  const launcher = new THREE.Group();
  launcher.userData.arms = [];
  const launcherMat = new THREE.MeshStandardMaterial({
      color: 0x929c98,
      metalness: 0.48,
      roughness: 0.48,
    }),
    roundMat = new THREE.MeshStandardMaterial({
      color: 0xd9ddd5,
      metalness: 0.42,
      roughness: 0.34,
    });
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 3.15, 0.55, 20),
    darkMat,
  );
  turntable.position.y = 0.28;
  launcher.add(turntable);
  const race = new THREE.Mesh(
    new THREE.TorusGeometry(2.48, 0.12, 7, 32),
    launcherMat,
  );
  race.rotation.x = Math.PI / 2;
  race.position.y = 0.6;
  launcher.add(race);
  const housing = new THREE.Mesh(
    createSlopedBoxGeometry(4.6, 1.35, 4.35, 0.45),
    launcherMat,
  );
  housing.position.set(-0.25, 1.15, 0);
  launcher.add(housing);
  const rearCab = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.2, 3.7),
    darkMat,
  );
  rearCab.position.set(-2, 1.2, 0);
  launcher.add(rearCab);
  const crossShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 4.15, 14),
    darkMat,
  );
  crossShaft.rotation.x = Math.PI / 2;
  crossShaft.position.set(-0.15, 2, 0);
  launcher.add(crossShaft);
  for (const z of [-1.72, 1.72]) {
    const trunnion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.48, 14),
      darkMat,
    );
    trunnion.rotation.x = Math.PI / 2;
    trunnion.position.set(-0.15, 2, z);
    launcher.add(trunnion);
    const arm = new THREE.Group();
    arm.name = "launcherArm";
    arm.position.set(-0.15, 2, z);
    launcher.userData.arms.push(arm);
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(7.7, 0.34, 0.42),
      launcherMat,
    );
    spine.position.set(2.4, 0, 0);
    arm.add(spine);
    for (const railOffset of [-0.23, 0.23]) {
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(7.4, 0.13, 0.1),
        darkMat,
      );
      guide.position.set(2.5, 0.28, railOffset);
      arm.add(guide);
    }
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.48, 0.75),
      darkMat,
    );
    shoe.position.set(0.3, 0.15, 0);
    arm.add(shoe);
    const readyRound = new THREE.Group();
    readyRound.name = "readyRound";
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 5.5, 10),
      roundMat,
    );
    body.rotation.z = Math.PI / 2;
    readyRound.add(body);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.72, 10),
      roundMat,
    );
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 3.1;
    readyRound.add(nose);
    for (const finZ of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.06, 0.42),
        darkMat,
      );
      fin.position.set(-2.45, 0, finZ * 0.3);
      readyRound.add(fin);
    }
    readyRound.position.set(3.15, 0.42, 0);
    arm.add(readyRound);
    launcher.add(arm);
  }
  for (const side of [-1, 1]) {
    const serviceRail = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.12, 0.12),
      deckMat,
    );
    serviceRail.position.set(-0.2, 0.72, side * 2.35);
    launcher.add(serviceRail);
    const loaderGuide = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.16, 0.34),
      darkMat,
    );
    loaderGuide.position.set(-2.65, 0.7, side * 1.72);
    launcher.add(loaderGuide);
    const hydraulic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, 2.25, 8),
      launcherMat,
    );
    hydraulic.rotation.z = Math.PI / 2;
    hydraulic.position.set(0.55, 1.45, side * 1.72);
    launcher.add(hydraulic);
  }
  const loaderDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.1, 3.65),
    darkMat,
  );
  loaderDoor.position.set(-3.12, 0.67, 0);
  launcher.add(loaderDoor);
  return launcher;
}

function createMk143Abl(
  hullMat: THREE.Material,
  darkMat: THREE.Material,
) {
  const launcher = new THREE.Group();
  const housing = new THREE.Mesh(
    createSlopedBoxGeometry(4.15, 1.55, 1.48, 0.22),
    hullMat,
  );
  housing.position.y = 0.78;
  housing.rotation.z = -0.085;
  launcher.add(housing);

  const muzzleFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.35, 1.26),
    darkMat,
  );
  muzzleFace.position.set(2.03, 0.83, 0);
  muzzleFace.rotation.z = -0.085;
  launcher.add(muzzleFace);

  for (const z of [-0.42, 0, 0.42]) {
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(3.92, 0.055, 0.045),
      darkMat,
    );
    divider.position.set(-0.03, 0.94, z);
    divider.rotation.z = -0.085;
    launcher.add(divider);
  }
  for (const x of [-1.28, 0, 1.28]) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.64, 1.58),
      darkMat,
    );
    rib.position.set(x, 0.75, 0);
    rib.rotation.z = -0.085;
    launcher.add(rib);
  }
  return launcher;
}

function createDeckCircle(
  radius: number,
  tube: number,
  material: THREE.Material,
) {
  const circle = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 5, 48),
    material,
  );
  circle.rotation.x = Math.PI / 2;
  return circle;
}
export function buildLongBeach(color = 0x7a8583, scale = 1) {
  // Ship-local axes: +X bow, -Z starboard, +Z port.
  const g = new THREE.Group();
  g.scale.set(scale, scale * LONG_BEACH_VERTICAL_SCALE, scale);
  const hullMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.16,
    roughness: 0.48,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x707d7c,
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x263538,
    metalness: 0.5,
    roughness: 0.45,
  });
  applySurfaceDetail(hullMat, "painted-metal", 0.32);
  applySurfaceDetail(deckMat, "weather-deck", 0.48);
  applySurfaceDetail(darkMat, "dark-metal", 0.34);
  const hull = new THREE.Mesh(createLoftedHullGeometry(LONG_BEACH_HULL), hullMat);
  g.add(hull);
  const mainDeck = new THREE.Mesh(
    createSheerDeckGeometry(LONG_BEACH_HULL),
    deckMat,
  );
  g.add(mainDeck);
  const waterline = new THREE.Mesh(
    createWaterlineBandGeometry(LONG_BEACH_HULL),
    new THREE.MeshStandardMaterial({ color: 0x151d20, roughness: 0.75 }),
  );
  g.add(waterline);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(25, 0.62, 2.1), darkMat);
  keel.position.set(-1.5, 0.1, 0);
  g.add(keel);

  // The NTU fantail is a broad, unobstructed helicopter landing area.  The
  // previous rectangular "aft deck" sat amidships and made the stern read as
  // a conventional gun cruiser.
  const flightDeck = new THREE.Mesh(
    createChamferedBoxGeometry(16.8, 0.42, 5.62, 0.34),
    deckMat,
  );
  flightDeck.position.set(-21.25, 6.02, 0);
  g.add(flightDeck);

  // Long Beach's identifying feature is the long, almost full-beam box
  // superstructure.  Preserve its mass but split it into a lower skirt,
  // vertical electronics block and narrower bridge tier so it does not read
  // as one untextured cube.
  const bridgeSkirt = new THREE.Mesh(
    createChamferedBoxGeometry(19.4, 1.2, 5.55, 0.28),
    deckMat,
  );
  bridgeSkirt.position.set(3.7, 6.72, 0);
  g.add(bridgeSkirt);
  const bridge = new THREE.Mesh(
    createChamferedBoxGeometry(17.2, 6.75, 5.18, 0.28),
    deckMat,
  );
  bridge.position.set(4.25, 10.05, 0);
  g.add(bridge);
  const bridgeRoof = new THREE.Mesh(
    createChamferedBoxGeometry(17.65, 0.42, 5.42, 0.24),
    darkMat,
  );
  bridgeRoof.position.set(4.15, 13.52, 0);
  g.add(bridgeRoof);
  const mast = new THREE.Group();
  const mastFeet = [
      new THREE.Vector3(-1.4, 14.1, -2.25),
      new THREE.Vector3(-1.4, 14.1, 2.25),
      new THREE.Vector3(3.2, 14.1, 0),
    ],
    mastCrown = [
      new THREE.Vector3(0.45, 22, -0.62),
      new THREE.Vector3(0.45, 22, 0.62),
      new THREE.Vector3(1.55, 22, 0),
    ];
  mastFeet.forEach((foot, index) =>
    addStrut(mast, foot, mastCrown[index], 0.19, darkMat),
  );
  for (let y = 15.5; y < 21.5; y += 1.65) {
    const fraction = (y - 14.1) / 7.9,
      port = new THREE.Vector3(
        THREE.MathUtils.lerp(-1.4, 0.45, fraction),
        y,
        THREE.MathUtils.lerp(-2.25, -0.62, fraction),
      ),
      starboard = new THREE.Vector3(port.x, y, -port.z);
    addStrut(mast, port, starboard, 0.075, darkMat);
    if (Math.round((y - 15.5) / 1.65) % 2 === 0)
      addStrut(
        mast,
        port,
        new THREE.Vector3(
          THREE.MathUtils.lerp(3.2, 1.55, fraction),
          y + 0.8,
          0,
        ),
        0.07,
        darkMat,
      );
  }
  const mastPlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.6, 0.34, 12),
    darkMat,
  );
  mastPlatform.position.set(1, 22, 0);
  mast.add(mastPlatform);
  const upperMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 7.2, 8),
    darkMat,
  );
  upperMast.position.set(1, 25.5, 0);
  mast.add(upperMast);
  g.add(mast);
  const yard = new THREE.Mesh(new THREE.BoxGeometry(9, 0.24, 0.24), darkMat);
  yard.position.set(1, 27.1, 0);
  g.add(yard);
  const radar = new THREE.Group();
  radar.position.set(1, 24, 0);
  const dish = new THREE.Mesh(
    new THREE.BoxGeometry(3.7, 2.75, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0x9caaa6,
      metalness: 0.35,
      roughness: 0.56,
      transparent: true,
      opacity: 0.74,
      side: THREE.DoubleSide,
    }),
  );
  dish.rotation.z = 0.08;
  radar.add(dish);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.8, 0.62), darkMat);
  backing.position.z = -0.42;
  radar.add(backing);
  for (let x = -2; x <= 2; x++)
    for (let y = -1; y <= 1; y++) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.54, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0xc1cbc5,
          metalness: 0.3,
          roughness: 0.5,
        }),
      );
      cell.position.set(x * 0.68, y * 0.84, 0.13);
      radar.add(cell);
    }
  const feed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8),
    darkMat,
  );
  feed.rotation.x = Math.PI / 2;
  feed.position.z = 1.05;
  radar.add(feed);
  for (const side of [-1, 1]) {
    addStrut(
      radar,
      new THREE.Vector3(side * 1.62, -1.12, -0.18),
      new THREE.Vector3(side * 0.58, -0.72, -0.92),
      0.08,
      darkMat,
    );
    addStrut(
      radar,
      new THREE.Vector3(side * 1.62, 1.12, -0.18),
      new THREE.Vector3(side * 0.58, 0.72, -0.92),
      0.08,
      darkMat,
    );
  }
  const radarGearbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.62, 1.4, 10),
    darkMat,
  );
  radarGearbox.position.set(0, -1.76, -0.32);
  radar.add(radarGearbox);
  const searchBeam = new THREE.Mesh(
    createSectorGeometry(105, THREE.MathUtils.degToRad(8)),
    new THREE.MeshBasicMaterial({
      color: 0x5ee9df,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  searchBeam.position.y = 0.15;
  searchBeam.userData.temporalReactive = true;
  radar.add(searchBeam);
  radar.userData.searchBeam = searchBeam;
  g.add(radar);
  const fireControl = new THREE.Group();
  fireControl.position.set(8, 13, 0);
  fireControl.userData.static = true;
  g.add(fireControl);
  // Both Mk 10 batteries were carried in tandem on the forecastle.  Keep the
  // historical `launcher` handle for the after unit so the launch runtime and
  // ammunition routing remain unchanged.
  const launcher = createMk10Launcher(deckMat, darkMat);
  launcher.position.set(16.9, 6.3, 0);
  launcher.rotation.y = Math.PI;
  launcher.scale.setScalar(0.5);
  g.add(launcher);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x75d8d4,
    emissive: 0x164b4a,
    emissiveIntensity: 1.8,
  });
  const windows = new THREE.Group();
  for (let z = -1.9; z <= 1.9; z += 0.95) {
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.5, 0.72),
      windowMat,
    );
    pane.position.set(12.93, 12.25, z);
    windows.add(pane);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.72, 0.07),
      darkMat,
    );
    frame.position.set(13.04, 12.25, z + 0.42);
    windows.add(frame);
  }
  for (const side of [-1, 1])
    for (let x = 8.2; x <= 11.7; x += 1.15) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.5, 0.18),
        windowMat,
      );
      pane.position.set(x, 12.25, side * 2.64);
      windows.add(pane);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.72, 0.22),
        darkMat,
      );
      frame.position.set(x + 0.5, 12.25, side * 2.69);
      windows.add(frame);
    }
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 4.95), darkMat);
  brow.position.set(13.08, 12.73, 0);
  windows.add(brow);
  g.add(windows);
  const upperBridge = new THREE.Mesh(
    createSlopedBoxGeometry(6.5, 2.35, 4.35, 0.62),
    deckMat,
  );
  upperBridge.position.set(8.75, 14.78, 0);
  g.add(upperBridge);
  const bridgeDetails = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(4.1, 0.24, 1.55),
      deckMat,
    );
    wing.position.set(10, 13.72, side * 2.22);
    bridgeDetails.add(wing);
    const bulwark = new THREE.Mesh(
      new THREE.BoxGeometry(4.1, 0.62, 0.12),
      darkMat,
    );
    bulwark.position.set(10, 14.06, side * 2.96);
    bridgeDetails.add(bulwark);
    for (let x = 8.2; x <= 11.8; x += 0.9) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5),
        darkMat,
      );
      post.position.set(x, 14.36, side * 2.92);
      bridgeDetails.add(post);
    }
    addStrut(
      bridgeDetails,
      new THREE.Vector3(8.25, 13.42, side * 2.05),
      new THREE.Vector3(8.25, 13.68, side * 2.82),
      0.07,
      darkMat,
    );
    addStrut(
      bridgeDetails,
      new THREE.Vector3(11.75, 13.42, side * 2.05),
      new THREE.Vector3(11.75, 13.68, side * 2.82),
      0.07,
      darkMat,
    );
    const pelorus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8),
      darkMat,
    );
    pelorus.position.set(10.8, 14.1, side * 2.42);
    bridgeDetails.add(pelorus);
  }
  for (const side of [-1, 1])
    for (let x = -2.8; x <= 9.6; x += 1.55) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.55, 0.08),
        darkMat,
      );
      vent.position.set(x, 8.15, side * 2.63);
      bridgeDetails.add(vent);
    }
  g.add(bridgeDetails);
  const aftHouse = new THREE.Mesh(
    createSlopedBoxGeometry(8.6, 3.05, 4.55, 0.38),
    deckMat,
  );
  aftHouse.position.set(-8.85, 8.05, 0);
  g.add(aftHouse);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(
      createSlopedBoxGeometry(4.8, 1.35, 0.92, 0.42),
      deckMat,
    );
    shoulder.position.set(-9.25, 7.12, side * 2.72);
    shoulder.rotation.y = side * 0.04;
    g.add(shoulder);
  }
  // Nuclear propulsion means there is no propulsion funnel.  These compact
  // rectangular trunks are ventilation/auxiliary diesel exhausts visible on
  // the NTU roof, and intentionally have no normal-operation smoke emitters.
  const ventTrunks = new THREE.Group();
  for (const z of [-0.72, 0.72]) {
    const trunk = new THREE.Mesh(
      createSlopedBoxGeometry(1.45, 2.25, 0.72, 0.16),
      darkMat,
    );
    trunk.position.set(-1.8, 14.75, z);
    ventTrunks.add(trunk);
  }
  g.add(ventTrunks);

  // The paired 5-in/38 mounts sit on beam sponsons abaft the main box, not on
  // the forecastle ahead of it.
  for (const side of [-1, 1]) {
    const sponson = new THREE.Mesh(
      createChamferedBoxGeometry(4.3, 0.34, 1.5, 0.18),
      deckMat,
    );
    sponson.position.set(-7.35, 6.28, side * 2.35);
    g.add(sponson);
  }
  const gunMount = new THREE.Group();
  gunMount.position.set(-7.35, 6.72, -2.52);
  gunMount.rotation.y = -0.18;
  gunMount.scale.setScalar(0.38);
  const turret = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.8, 1.25, 10),
    deckMat,
  );
  gunMount.add(turret);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 6, 8),
    darkMat,
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(3, 1, 0);
  gunMount.add(barrel);
  const portGun = gunMount.clone(true);
  portGun.position.z = 2.52;
  portGun.rotation.y = 0.18;
  g.add(gunMount, portGun);
  const aftDirector = new THREE.Group();
  aftDirector.position.set(-7, 12, 0);
  aftDirector.userData.static = true;
  const aftDirectorPedestal = new THREE.Object3D();
  g.add(aftDirectorPedestal, aftDirector);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 52, 6),
      new THREE.MeshStandardMaterial({
        color: 0xa5afaa,
        metalness: 0.5,
        roughness: 0.5,
      }),
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-1, 7, side * 2.96);
    g.add(rail);
    for (let x = -26; x <= 24; x += 4) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 1.2, 6),
        darkMat,
      );
      post.position.set(x, 6.5, side * 2.96);
      g.add(post);
    }
  }
  for (const side of [-1, 1])
    for (const x of [-5, -1]) {
      const raft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.65 }),
      );
      raft.rotation.z = Math.PI / 2;
      raft.position.set(x - 2, 9.05, side * 2.55);
      g.add(raft);
    }
  for (const x of [-5, 5]) {
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 7, 6),
      darkMat,
    );
    antenna.position.set(x, 17, 0);
    antenna.rotation.z = x < 0 ? -0.18 : 0.18;
    g.add(antenna);
  }
  const navigationLights: THREE.PointLight[] = [],
    lightBulbs: THREE.Mesh[] = [];
  const numberMat = new THREE.MeshBasicMaterial({
    map: createHullNumberTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const side of [-1, 1]) {
    const number = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), numberMat);
    number.position.set(23.7, 3.75, side * 2.02);
    number.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(number);
    const lampColor = side < 0 ? 0x36ff78 : 0xff3a32,
      nav = new THREE.PointLight(lampColor, 3, 18),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: lampColor }),
      );
    nav.position.set(7.2, 14.2, side * 2.78);
    bulb.position.copy(nav.position);
    addStrut(
      g,
      new THREE.Vector3(7.2, 13.92, side * 2.25),
      bulb.position,
      0.065,
      darkMat,
    );
    navigationLights.push(nav);
    lightBulbs.push(bulb);
    g.add(nav, bulb);
    for (const x of [-17, -9, 1, 12]) {
      const port = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 7, 5),
        new THREE.MeshBasicMaterial({ color: 0xffd99a }),
      );
      port.position.set(x, 7.05, side * 2.91);
      lightBulbs.push(port);
      g.add(port);
    }
  }
  for (const [x, y, color] of [
    [1, 29, 0xf4fff1],
    [-7, 24, 0xf4fff1],
    [-27, 8, 0xf4fff1],
  ] as const) {
    const light = new THREE.PointLight(color, 2.2, 22),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
    light.position.set(x, y, 0);
    bulb.position.copy(light.position);
    navigationLights.push(light);
    lightBulbs.push(bulb);
    g.add(light, bulb);
  }
  for (const side of [-1, 1]) {
    const anchor = createHawsePipe(0.45, 0.12, darkMat);
    anchor.position.set(24.1, 3.45, side * 2.02);
    anchor.rotation.x = Math.PI / 2;
    g.add(anchor);
  }
  for (const x of [-15, -10, 10]) {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.16, 1.4),
      darkMat,
    );
    hatch.position.set(x, 6.3, 0);
    g.add(hatch);
  }
  for (const x of [-14, -8, 0, 8, 14]) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.8, 8),
      darkMat,
    );
    bollard.position.set(x, 6.5, 2.72);
    g.add(bollard);
  }
  // The forward battery is the same Mk 10 installation and is not a smaller
  // decorative clone.  Construct it independently so each launcher retains
  // its own animated rail and ready-round objects.
  const forwardLauncher = createMk10Launcher(deckMat, darkMat);
  forwardLauncher.position.set(23.45, 6.55, 0);
  forwardLauncher.rotation.y = Math.PI;
  forwardLauncher.scale.setScalar(0.5);
  g.add(forwardLauncher);
  const surfaceStrikeHardpoints: ModelWeaponHardpoint[] = [],
    surfaceStrikeLaunchers: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const harpoon = createMk141Launcher(
      deckMat,
      darkMat,
      `mk141-${side > 0 ? "port" : "starboard"}`,
    );
    harpoon.position.set(-12.4, 6.34, side * 1.62);
    harpoon.scale.setScalar(0.72);
    // Cant each bank away from the centreline so a departing round clears the ship.
    harpoon.rotation.y = -side * 0.4;
    surfaceStrikeHardpoints.push(
      ...(harpoon.userData.weaponHardpoints as ModelWeaponHardpoint[]),
    );
    surfaceStrikeLaunchers.push(harpoon);
    g.add(harpoon);
  }
  const safetyMat = new THREE.MeshStandardMaterial({
    color: 0xd5b64e,
    metalness: 0.2,
    roughness: 0.65,
  });
  for (const [x, length] of [
    [16.9, 2.25],
    [23.45, 2.25],
  ] as const) {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.09, 2.36),
      darkMat,
    );
    hatch.position.set(x, 6.16, 0);
    g.add(hatch);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(length + 0.45, 0.035, 0.09),
        safetyMat,
      );
      stripe.position.set(x, 6.23, side * 1.3);
      g.add(stripe);
    }
    for (const end of [-1, 1]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.035, 2.62),
        safetyMat,
      );
      stripe.position.set(x + (end * (length + 0.45)) / 2, 6.23, 0);
      g.add(stripe);
    }
  }

  // Two Mk 143 Armored Box Launchers replaced the former aft Talos
  // installation.  They flank the forward edge of the helicopter deck.
  const ablLaunchers: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const abl = createMk143Abl(deckMat, darkMat);
    abl.name = `mk143-${side > 0 ? "port" : "starboard"}`;
    abl.position.set(-19.05, 6.2, side * 1.63);
    abl.rotation.y = side * 0.055;
    ablLaunchers.push(abl);
    g.add(abl);
  }

  const landingMarkMat = new THREE.MeshBasicMaterial({
    color: 0xe9e5ce,
    side: THREE.DoubleSide,
  });
  const landingCircle = createDeckCircle(2.35, 0.085, landingMarkMat);
  landingCircle.position.set(-25.55, 6.25, 0);
  g.add(landingCircle);
  const landingLine = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 0.025, 0.12),
    landingMarkMat,
  );
  landingLine.position.set(-25.55, 6.26, 0);
  g.add(landingLine);
  const landingCross = landingLine.clone();
  landingCross.geometry = new THREE.BoxGeometry(0.12, 0.025, 4.35);
  g.add(landingCross);

  const aftMast = new THREE.Group();
  aftMast.position.set(-8.9, 10.1, 0);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 12, 7),
      darkMat,
    );
    leg.position.set(0, 5, side * 1.55);
    leg.rotation.x = side * 0.18;
    aftMast.add(leg);
  }
  for (let y = 1; y <= 10; y += 2) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 3.2),
      darkMat,
    );
    brace.position.y = y;
    aftMast.add(brace);
  }
  const sps49 = new THREE.Group(),
    antennaMat = new THREE.MeshStandardMaterial({
      color: 0xaab8b3,
      metalness: 0.62,
      roughness: 0.32,
    });
  sps49.position.y = 11;
  const antennaFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.16, 0.16),
    antennaMat,
  );
  sps49.add(antennaFrame);
  for (let x = -2.5; x <= 2.5; x += 0.5) {
    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 2.25, 0.07),
      antennaMat,
    );
    vertical.position.set(x, 0, 0);
    sps49.add(vertical);
  }
  for (const y of [-1.08, -0.54, 0, 0.54, 1.08]) {
    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.05, 0.07),
      antennaMat,
    );
    horizontal.position.y = y;
    sps49.add(horizontal);
  }
  const antennaFeed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
    darkMat,
  );
  antennaFeed.rotation.x = Math.PI / 2;
  antennaFeed.position.z = 1.05;
  sps49.add(antennaFeed);
  aftMast.add(sps49);
  g.add(aftMast);
  const visualDirectors: THREE.Group[] = [],
    directorSupports: THREE.Mesh[] = [];
  for (const [x, z, heading, y] of [
    [10.25, -2.52, -0.42, 14.55],
    [10.25, 2.52, 0.42, 14.55],
    [-2.35, -2.52, Math.PI + 0.42, 14.45],
    [-2.35, 2.52, Math.PI - 0.42, 14.45],
  ] as const) {
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.68, 1.35, 12),
      deckMat,
    );
    support.position.set(x, y - 0.72, z);
    directorSupports.push(support);
    g.add(support);
    const director = new THREE.Group();
    director.position.set(x, y, z);
    director.rotation.y = heading;
    director.scale.setScalar(0.48);
    director.userData.stowHeading = heading;
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.05, 1.4, 12),
      darkMat,
    );
    director.add(pedestal);
    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.45, 2.15),
      darkMat,
    );
    yoke.position.y = 0.78;
    director.add(yoke);
    const elevationPivot = new THREE.Group();
    elevationPivot.position.set(0, 0.82, 0);
    director.add(elevationPivot);
    const dishBack = new THREE.Mesh(
      new THREE.CylinderGeometry(1.48, 1.22, 0.34, 18),
      darkMat,
    );
    dishBack.rotation.z = Math.PI / 2;
    dishBack.position.x = 0.82;
    elevationPivot.add(dishBack);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      new THREE.MeshStandardMaterial({
        color: 0xaab7b2,
        metalness: 0.45,
        roughness: 0.38,
        side: THREE.DoubleSide,
      }),
    );
    dish.rotation.z = -Math.PI / 2;
    dish.position.x = 1.05;
    elevationPivot.add(dish);
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 1.9, 8),
      darkMat,
    );
    horn.rotation.z = Math.PI / 2;
    horn.position.x = 2;
    elevationPivot.add(horn);
    const feedTip = new THREE.Object3D();
    feedTip.position.x = 3;
    elevationPivot.add(feedTip);
    director.userData.elevationPivot = elevationPivot;
    director.userData.feedTip = feedTip;
    visualDirectors.push(director);
    g.add(director);
  }
  // Preserve the existing two-channel illumination runtime while displaying
  // all four late-fit SPG-55 mounts.  The selected forward/aft pair remains
  // the animated interface consumed by combat code.
  const directors = [visualDirectors[0], visualDirectors[2]].filter(
    (director): director is THREE.Group => Boolean(director),
  );
  const highDetail = new THREE.Group();
  for (const [x, z] of [
    [-11.3, -2.65],
    [-11.3, 2.65],
  ] as const) {
    const boat = createShipBoat(
      0.62,
      3.4,
      new THREE.MeshStandardMaterial({ color: 0xc4c1ac, roughness: 0.68 }),
    );
    boat.position.set(x, 9.05, z);
    highDetail.add(boat);
  }

  // Break up the otherwise featureless electronics box with restrained
  // plating joints, equipment-access panels and side catwalks visible in the
  // 1989 NARA broadside imagery.
  const superstructureSeamMat = new THREE.MeshStandardMaterial({
    color: 0x4b5858,
    metalness: 0.08,
    roughness: 0.72,
  });
  for (const side of [-1, 1]) {
    for (const x of [-3.6, -0.6, 2.4, 5.4, 8.4, 11.4]) {
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 5.7, 0.025),
        superstructureSeamMat,
      );
      seam.position.set(x, 10.05, side * 2.605);
      highDetail.add(seam);
    }
    for (const y of [7.25, 10.55, 13.22]) {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(16.4, 0.045, 0.035),
        superstructureSeamMat,
      );
      belt.position.set(4.25, y, side * 2.615);
      highDetail.add(belt);
    }
    const accessDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 2.05, 0.045),
      darkMat,
    );
    accessDoor.position.set(-2.9, 8.1, side * 2.63);
    highDetail.add(accessDoor);
    const catwalk = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.14, 0.58),
      deckMat,
    );
    catwalk.position.set(2.8, 12.95, side * 2.86);
    highDetail.add(catwalk);
    for (let x = -3.6; x <= 9.4; x += 1.3) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.52, 0.07),
        darkMat,
      );
      bracket.position.set(x, 12.68, side * 2.86);
      highDetail.add(bracket);
    }
  }
  for (const [name, x, z, heading] of [
    ["ciwsFore", -13.25, -2.15, 0],
    ["ciwsAft", -13.25, 2.15, Math.PI],
  ] as const) {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.95, 0.34, 10),
      deckMat,
    );
    platform.position.set(x, 6.55, z);
    highDetail.add(platform);
    const ciws = new THREE.Group();
    ciws.name = name;
    ciws.position.set(x, 6.78, z);
    ciws.rotation.y = heading;
    ciws.scale.setScalar(0.5);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.05, 0.8, 12),
      deckMat,
    );
    ciws.add(base);
    const turret = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.2, 1),
      new THREE.MeshStandardMaterial({
        color: 0xd2d7cf,
        metalness: 0.35,
        roughness: 0.48,
      }),
    );
    turret.position.y = 1;
    ciws.add(turret);
    const elevationPivot = new THREE.Group();
    elevationPivot.position.set(0, 1.18, 0);
    for (let barrelIndex = -1; barrelIndex <= 1; barrelIndex++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6),
        darkMat,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(1.45, 0, barrelIndex * 0.13);
      elevationPivot.add(barrel);
    }
    const radome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 7),
      new THREE.MeshStandardMaterial({ color: 0xe0e3dc, roughness: 0.4 }),
    );
    radome.position.set(-0.2, 0.6, 0);
    ciws.add(radome);
    ciws.add(elevationPivot);
    ciws.userData.elevationPivot = elevationPivot;
    highDetail.add(ciws);
  }
  for (const side of [-1, 1])
    for (let x = -26; x <= 24; x += 3) {
      const stanchion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5),
        darkMat,
      );
      stanchion.position.set(x, 6.75, side * 2.94);
      highDetail.add(stanchion);
    }
  const breakwater = new THREE.Mesh(
    createSlopedBoxGeometry(0.7, 1.2, 5.25, 0.18),
    darkMat,
  );
  breakwater.position.set(18.5, 6.75, 0);
  breakwater.rotation.z = -0.18;
  highDetail.add(breakwater);
  for (const side of [-1, 1])
    for (const x of [-18, -11, 2, 11]) {
      const reel = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.1, 7, 14),
        darkMat,
      );
      reel.rotation.y = Math.PI / 2;
      reel.position.set(x, 6.65, side * 2.35);
      highDetail.add(reel);
    }
  for (const x of [-16, -6, 4, 14]) {
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 0.6, 8),
      darkMat,
    );
    vent.position.set(x, 6.55, -2.4);
    highDetail.add(vent);
  }
  const platingMat = new THREE.MeshStandardMaterial({
    color: 0x3f4d4e,
    metalness: 0.08,
    roughness: 0.74,
  });
  for (const side of [-1, 1]) {
    for (const x of [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.7, 0.025), platingMat);
      seam.position.set(x, 4.28, side * 2.88);
      highDetail.add(seam);
    }
    for (const x of [-23, -17, -11, -5, 1, 7, 13, 19]) {
      const scupper = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.045), darkMat);
      scupper.position.set(x, 5.52, side * 2.94);
      highDetail.add(scupper);
    }
  }
  // Damage smoke is supplied by the damage-effects runtime.  Keep the API
  // but do not attach false propulsion smoke to a nuclear-powered cruiser.
  const smokePuffs: THREE.Mesh[] = [];
  g.add(highDetail);
  const srbocLaunchers = new THREE.Group();
  for (const side of [-1, 1]) {
    const station = new THREE.Group();
    station.position.set(0, 7.25, side * 2.48);
    station.scale.setScalar(0.68);
    station.rotation.x = side * 0.42;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.25), darkMat);
    station.add(base);
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 3; column++) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.19, 1.8, 8),
          new THREE.MeshStandardMaterial({
            color: 0x687473,
            metalness: 0.62,
            roughness: 0.4,
          }),
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0.35, row * 0.42 - 0.2, column * 0.38 - 0.38);
        station.add(tube);
      }
    srbocLaunchers.add(station);
  }
  highDetail.add(srbocLaunchers);
  const ewPulse = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12 + i * 8, 0.08, 6, 72),
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
  for (const side of [-1, 1]) {
    const ewAntenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.18, 2.8, 8),
      darkMat,
    );
    ewAntenna.position.set(2.5, 16.2, side * 2.45);
    ewAntenna.rotation.x = side * 0.28;
    g.add(ewAntenna);
  }
  ewPulse.visible = false;
  g.add(ewPulse);
  const flagGeometry = new THREE.PlaneGeometry(3.8, 2, 12, 4);
  flagGeometry.translate(-1.9, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      map: createUSFlagTexture(),
      side: THREE.DoubleSide,
      roughness: 0.72,
    }),
  );
  flag.position.set(-8.9, 22.4, 0);
  highDetail.add(flag);
  for (const x of [16.9, 23.45]) {
    const safetyRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.045, 5, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe1c46d,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    safetyRing.rotation.x = Math.PI / 2;
    safetyRing.position.set(x, 6.24, 0);
    highDetail.add(safetyRing);
  }
  const mediumDetail = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = createGuardRailBeam(
      52,
      0.08,
      new THREE.MeshBasicMaterial({ color: 0x81908d }),
    );
    rail.position.set(-1, 6.9, side * 2.96);
    mediumDetail.add(rail);
  }
  for (const x of [-18, -8, 3, 14]) {
    const deckBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.45, 1.1),
      darkMat,
    );
    deckBox.position.set(x, 6.45, 2.7);
    mediumDetail.add(deckBox);
  }
  g.add(mediumDetail);
  const lowDetail = new THREE.Group();
  const lowMat = new THREE.MeshBasicMaterial({ color: 0x778482 });
  const lowDark = new THREE.MeshBasicMaterial({ color: 0x344043 });
  const lowMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.5, 15, 6),
    lowDark,
  );
  lowMast.position.set(1, 19, 0);
  const lowArray = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.6, 0.2),
    lowMat,
  );
  lowArray.position.set(1, 24.1, 0);
  const lowAftMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.38, 11.5, 5),
    lowDark,
  );
  lowAftMast.position.set(-8.9, 16.2, 0);
  const lowSps49 = new THREE.Mesh(
    new THREE.BoxGeometry(5.25, 1.85, 0.16),
    lowMat,
  );
  lowSps49.position.set(-8.9, 21.05, 0);

  // Standard quality still needs Long Beach's unmistakable command-island
  // silhouette.  The full bridge geometry remains part of the persistent
  // model, while these inexpensive accents replace the windows, roof crown
  // and mast shoulders that are intentionally culled with `detail`.
  const lowBridgeCrown = new THREE.Mesh(
    createSlopedBoxGeometry(6.65, 0.62, 4.55, 0.28),
    lowDark,
  );
  lowBridgeCrown.position.set(8.65, 16.22, 0);
  const lowBridgeFrontWindows = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.62, 4.08),
    lowDark,
  );
  lowBridgeFrontWindows.position.set(12.04, 15.02, 0);
  const lowBridgeSideWindows = [-1, 1].map((side) => {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(4.45, 0.58, 0.1),
      lowDark,
    );
    band.position.set(9.35, 15.02, side * 2.22);
    return band;
  });
  const lowMastShoulders = [-1, 1].map((side) => {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.22, 0.22),
      lowDark,
    );
    shoulder.position.set(0.15, 17.45, side * 1.12);
    shoulder.rotation.z = side * 0.7;
    return shoulder;
  });

  const createLowMk10 = (x: number, y: number) => {
    const lowLauncher = new THREE.Group();
    lowLauncher.position.set(x, y, 0);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.36, 0.38, 8),
      lowDark,
    );
    base.position.y = 0.19;
    lowLauncher.add(base);
    const housing = new THREE.Mesh(
      createSlopedBoxGeometry(1.7, 0.72, 1.72, 0.18),
      lowMat,
    );
    housing.position.set(0.25, 0.72, 0);
    lowLauncher.add(housing);
    for (const z of [-0.58, 0.58]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.22, 0.24),
        lowMat,
      );
      arm.position.set(-1.25, 1.08, z);
      lowLauncher.add(arm);
    }
    return lowLauncher;
  };
  const lowAfterMk10 = createLowMk10(16.9, 6.25);
  const lowForwardMk10 = createLowMk10(23.45, 6.5);
  const lowAblPort = new THREE.Mesh(
    createSlopedBoxGeometry(4.05, 1.45, 1.42, 0.18),
    lowMat,
  );
  lowAblPort.position.set(-19.05, 6.95, 1.63);
  const lowAblStarboard = lowAblPort.clone();
  lowAblStarboard.position.z = -1.63;
  const lowHelipad = createDeckCircle(2.32, 0.11, landingMarkMat);
  lowHelipad.position.set(-25.55, 6.26, 0);
  lowDetail.add(
    lowMast,
    lowArray,
    lowAftMast,
    lowSps49,
    lowBridgeCrown,
    lowBridgeFrontWindows,
    ...lowBridgeSideWindows,
    ...lowMastShoulders,
    lowAfterMk10,
    lowForwardMk10,
    lowAblPort,
    lowAblStarboard,
    lowHelipad,
  );
  lowDetail.visible = false;
  g.add(lowDetail);
  g.userData = {
    hullStations: LONG_BEACH_HULL.length,
    hullSectionPoints: 8,
    hullLength: LONG_BEACH_MODEL_LENGTH,
    hullBeam: LONG_BEACH_MODEL_BEAM,
    realLengthMeters: LONG_BEACH_REAL_LENGTH_M,
    realBeamMeters: LONG_BEACH_REAL_BEAM_M,
    modelMetersPerUnit: LONG_BEACH_REAL_LENGTH_M / LONG_BEACH_MODEL_LENGTH,
    verticalScale: LONG_BEACH_VERTICAL_SCALE,
    surfaceStrikeHardpoints,
    radar,
    secondaryRadar: sps49,
    fireControl,
    launcher,
    forwardLauncher,
    directors,
    highDetail,
    mediumDetail,
    lowDetail,
    smokePuffs,
    flag,
    hullMat,
    ewPulse,
    navigationLights,
    lightBulbs,
    detail: [
      mast,
      radar,
      fireControl,
      launcher,
      forwardLauncher,
      windows,
      aftMast,
      ventTrunks,
      gunMount,
      portGun,
      aftDirector,
      aftDirectorPedestal,
      ...directorSupports,
      ...surfaceStrikeLaunchers,
      ...ablLaunchers,
      landingCircle,
      landingLine,
      landingCross,
      ...visualDirectors,
    ],
  };
  return g;
}
