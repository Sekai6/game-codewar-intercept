import * as THREE from "three";
import { applySurfaceDetail } from "../visual/material-textures.js";
import { registerAssetDetailLod } from "../visual/asset-detail-lod.js";
import { createThreatParticleTrail } from "../visual/threat-particles.js";

interface EffectOptions {
  length: number;
  radius: number;
  exhaustLength: number;
  exhaustColor?: number;
  exhaustOpacity?: number;
  mistRadius: number;
  mistLength: number;
  mistOpacity?: number;
  seekerRadius: number;
  seekerLength: number;
  shockCone?: boolean;
  glow?: { intensity: number; distance: number };
}

export function attachThreatEffects(group: THREE.Group, options: EffectOptions) {
  const particleTrail = createThreatParticleTrail({
    nozzleZ: options.length * 0.5 + 0.2,
    trailLength: Math.max(
      options.exhaustLength * 1.35,
      options.mistLength * 0.82,
    ),
    radius: Math.max(options.radius * 0.6, options.mistRadius * 0.5),
    color: options.exhaustColor ?? 0xff7138,
  });
  group.add(particleTrail);

  if (options.glow) {
    const glow = new THREE.PointLight(
      options.exhaustColor ?? 0xff642d,
      options.glow.intensity,
      options.glow.distance,
    );
    glow.position.z = options.length * 0.5 + options.exhaustLength * 0.4;
    group.add(glow);
  }

  let shockCone: THREE.Mesh | undefined;
  if (options.shockCone) {
    shockCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 7, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe7f4f2,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    shockCone.rotation.x = -Math.PI / 2;
    shockCone.position.z = -options.length * 0.16;
    shockCone.visible = false;
    group.add(shockCone);
  }

  const seekerFov = new THREE.Mesh(
    new THREE.ConeGeometry(
      options.seekerRadius,
      options.seekerLength,
      24,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color: 0xff6554,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  seekerFov.rotation.x = -Math.PI / 2;
  seekerFov.position.z =
    -options.length * 0.5 - options.seekerLength * 0.52;
  seekerFov.visible = false;
  group.add(seekerFov);

  group.userData.particleTrail = particleTrail;
  group.userData.particleCount = particleTrail.geometry.attributes.position.count;
  group.userData.seaMistActive = false;
  group.userData.shockCone = shockCone;
  group.userData.seekerFov = seekerFov;
  group.userData.modelLength = options.length;
}

export function addThreatRadialFinSet(
  group: THREE.Group,
  options: { z:number; radius:number; span:number; chord:number; thickness:number; material:THREE.Material; swept?:boolean },
) {
  const shape=new THREE.Shape();
  shape.moveTo(options.radius*.7,-options.chord*.52);
  shape.lineTo(options.radius+options.span,options.swept?-options.chord*.04:-options.chord*.18);
  shape.lineTo(options.radius+options.span,options.chord*.34);
  shape.lineTo(options.radius*.7,options.chord*.52);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:options.thickness,bevelEnabled:false,curveSegments:1});
  geometry.translate(0,0,-options.thickness*.5);geometry.rotateX(Math.PI*.5);
  for(let index=0;index<4;index++){
    const fin=new THREE.Mesh(geometry,options.material);fin.position.z=options.z;fin.rotation.z=index*Math.PI*.5;fin.castShadow=true;group.add(fin);
  }
}

export function addThreatSurfaceDetail(group:THREE.Group,length:number,radius:number,identity:string,material:THREE.Material){
  const high=new THREE.Group();high.name=`${identity} high surface detail`;
  for(const fraction of [-.3,-.02,.27]){
    const seam=new THREE.Mesh(new THREE.TorusGeometry(radius*.985,.014,5,24),material);seam.scale.y=.96;seam.position.z=fraction*length;high.add(seam);
  }
  for(const side of [-1,1]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.018,radius*.34,length*.055),new THREE.MeshStandardMaterial({color:0x596260,metalness:.32,roughness:.58}));panel.position.set(side*radius*.99,0,-length*.1);high.add(panel);
  }
  group.add(high);registerAssetDetailLod(group,{nearDistance:72,mediumDistance:190,high:[high]});
  group.userData.weaponVisualId=identity;group.userData.forwardAxis="-Z";group.userData.surfaceDetailCount=high.children.length;
}

export interface SovietThreatModelOptions {
  identity: string;
  length: number;
  radius: number;
  skinColor: number;
  bandColor: number;
  noseLength: number;
  wingSpan: number;
  wingChord: number;
  finThickness: number;
  finHeight: number;
  intake?: "side-lips" | "ventral";
  dorsalDetails?: boolean;
  exhaustLength: number;
  exhaustColor?: number;
  mistRadius: number;
  mistLength: number;
  seekerRadius: number;
  seekerLength: number;
  shockCone?: boolean;
}

export function createSovietThreatModel(options: SovietThreatModelOptions) {
  const group = new THREE.Group(),
    skin = applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: options.skinColor,
        metalness: 0.58,
        roughness: 0.4,
      }),
      "missile-skin",
      0.22,
    ),
    dark = applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: 0x242b2c,
        metalness: 0.55,
        roughness: 0.5,
      }),
      "dark-metal",
      0.3,
    );
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.9,
      options.radius,
      options.length,
      14,
    ),
    skin,
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const forwardBand = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.94,
      options.radius * 0.94,
      0.42,
      14,
    ),
    applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: options.bandColor,
        metalness: 0.65,
        roughness: 0.35,
      }),
      "dark-metal",
      0.2,
    ),
  );
  forwardBand.rotation.x = Math.PI / 2;
  forwardBand.position.z = -options.length * 0.28;
  group.add(forwardBand);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(options.radius * 0.9, options.noseLength, 14),
    skin,
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -options.length * 0.5 - options.noseLength * 0.48;
  group.add(nose);
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.72,
      options.radius,
      1.6,
      14,
    ),
    dark,
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = options.length * 0.5 + 0.6;
  group.add(tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(options.wingSpan, options.wingChord * 0.7);
  wingShape.lineTo(options.wingSpan * 0.78, -options.wingChord * 0.45);
  wingShape.lineTo(0, -options.wingChord * 0.7);
  wingShape.closePath();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), skin);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = side < 0 ? Math.PI : 0;
    wing.position.set(
      side * options.radius * 0.45,
      0,
      options.dorsalDetails ? 0.5 : 1,
    );
    group.add(wing);
  }
  addThreatRadialFinSet(group,{z:options.length*.35,radius:options.radius,span:options.finHeight,chord:2.5,thickness:options.finThickness,material:dark,swept:true});

  if (options.intake === "ventral") {
    const intake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 3, 10),
      dark,
    );
    intake.rotation.x = Math.PI / 2;
    intake.position.set(0, -options.radius * 0.85, 1);
    group.add(intake);
  } else if (options.intake === "side-lips") {
    for (const side of [-1, 1]) {
      const intakeLip = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.55, 2.6),
        dark,
      );
      intakeLip.position.set(side * 0.78, -0.68, 0.9);
      intakeLip.rotation.z = side * 0.16;
      group.add(intakeLip);
    }
  }

  if (options.dorsalDetails) {
    const dorsalShape=new THREE.Shape();dorsalShape.moveTo(0,0);dorsalShape.lineTo(4.5,0);dorsalShape.lineTo(3.25,2.8);dorsalShape.lineTo(.65,2.25);dorsalShape.closePath();
    const dorsal = new THREE.Mesh(new THREE.ShapeGeometry(dorsalShape),skin);
    dorsal.position.set(0, options.radius*.82, 3.5);
    dorsal.rotation.y = Math.PI*.5;
    group.add(dorsal);
    const belly = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 3.8),
      dark,
    );
    belly.position.set(0, -0.78, 1.1);
    group.add(belly);
  }

  attachThreatEffects(group, {
    length: options.length,
    radius: options.radius,
    exhaustLength: options.exhaustLength,
    exhaustColor: options.exhaustColor,
    mistRadius: options.mistRadius,
    mistLength: options.mistLength,
    seekerRadius: options.seekerRadius,
    seekerLength: options.seekerLength,
    shockCone: options.shockCone,
    glow: {
      intensity: options.shockCone ? 7 : 5,
      distance: options.shockCone ? 35 : 28,
    },
  });
  addThreatSurfaceDetail(group,options.length,options.radius,options.identity,dark);
  return group;
}
