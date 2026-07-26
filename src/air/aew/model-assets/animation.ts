import * as THREE from "three";

export interface AewRotorAnimationHandle {
  object: THREE.Group;
  direction: -1 | 1;
  speedScale: number;
}

export interface AewPropellerAnimationHandle {
  object: THREE.Group;
  rotors: readonly AewRotorAnimationHandle[];
}

export interface AewModelAnimationContract {
  rotodomes: readonly THREE.Group[];
  propellers: readonly AewPropellerAnimationHandle[];
}

export interface AewPropellerRotorOptions {
  direction: -1 | 1;
  axialOffset?: number;
  phase?: number;
  bladeCount?: number;
}

export interface AewPropellerOptions {
  radius: number;
  hubRadius: number;
  spinnerLength: number;
  bladeMaterial: THREE.Material;
  hubMaterial: THREE.Material;
  blurMaterial: THREE.Material;
  rotors: readonly AewPropellerRotorOptions[];
  bladeRootRadius?: number;
  bladeRootChord?: number;
  bladeMidChord?: number;
  bladeTipChord?: number;
  bladeThickness?: number;
  detailed?: boolean;
  blurOnly?: boolean;
}

function createBladeGeometry(options: AewPropellerOptions) {
  const rootRadius = options.bladeRootRadius ?? options.radius * 0.2;
  const rootChord = options.bladeRootChord ?? options.radius * 0.16;
  const midChord = options.bladeMidChord ?? options.radius * 0.13;
  const tipChord = options.bladeTipChord ?? options.radius * 0.075;
  const shape = new THREE.Shape();
  shape.moveTo(-rootChord * 0.5, rootRadius);
  shape.lineTo(-midChord * 0.58, options.radius * 0.58);
  shape.lineTo(-tipChord * 0.28, options.radius);
  shape.lineTo(tipChord * 0.72, options.radius * 0.985);
  shape.lineTo(midChord * 0.42, options.radius * 0.58);
  shape.lineTo(rootChord * 0.5, rootRadius);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: options.bladeThickness ?? Math.max(0.018, options.radius * 0.022),
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -(options.bladeThickness ?? Math.max(0.018, options.radius * 0.022)) * 0.5);
  geometry.rotateY(-0.16);
  geometry.computeVertexNormals();
  return geometry;
}

export function createAewPropeller(options: AewPropellerOptions): AewPropellerAnimationHandle {
  const object = new THREE.Group();
  object.name = options.rotors.length > 1 ? "aew-propeller:contra-rotating" : "aew-propeller:single-shaft";
  const rotorHandles: AewRotorAnimationHandle[] = [];
  const bladeGeometry = options.blurOnly ? null : createBladeGeometry(options);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  options.rotors.forEach((rotorOptions, rotorIndex) => {
    const rotor = new THREE.Group();
    rotor.name = `aew-propeller-rotor:${rotorIndex}`;
    rotor.position.z = rotorOptions.axialOffset ?? 0;
    const bladeCount = rotorOptions.bladeCount ?? 4;
    if (bladeGeometry) {
      const blades = new THREE.InstancedMesh(bladeGeometry, options.bladeMaterial, bladeCount);
      blades.name = `aew-propeller-blades:${bladeCount}`;
      for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex++) {
        quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          (rotorOptions.phase ?? 0) + bladeIndex / bladeCount * Math.PI * 2,
        );
        matrix.compose(new THREE.Vector3(), quaternion, scale);
        blades.setMatrixAt(bladeIndex, matrix);
      }
      blades.instanceMatrix.needsUpdate = true;
      blades.computeBoundingBox();
      blades.computeBoundingSphere();
      rotor.add(blades);
    }
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(options.hubRadius * 0.88, options.hubRadius, Math.max(0.12, options.hubRadius * 0.72), options.detailed ? 18 : 10),
      options.hubMaterial,
    );
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    object.add(rotor);
    rotorHandles.push({ object: rotor, direction: rotorOptions.direction, speedScale: 1 + rotorIndex * 0.035 });
  });

  const spinner = new THREE.Mesh(
    new THREE.ConeGeometry(options.hubRadius, options.spinnerLength, options.detailed ? 20 : 10),
    options.hubMaterial,
  );
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -options.spinnerLength * 0.5 - Math.abs(options.rotors[0]?.axialOffset ?? 0);
  object.add(spinner);

  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(options.radius, options.detailed ? 48 : 20),
    options.blurMaterial,
  );
  blur.name = "aew-propeller-motion-disc";
  blur.position.z = Math.max(...options.rotors.map((rotor) => rotor.axialOffset ?? 0), 0) + 0.02;
  object.add(blur);

  return { object, rotors: rotorHandles };
}

export function registerAewModelAnimation(
  model: THREE.Group,
  contract: AewModelAnimationContract,
  compatibility: {
    rotodome: THREE.Group;
    propellers: readonly THREE.Group[];
  },
) {
  model.userData.aewModelAnimation = contract;
  model.userData.rotodome = compatibility.rotodome;
  model.userData.rotodomes = [...contract.rotodomes];
  model.userData.propellers = [...compatibility.propellers];
  model.userData.propellerAssemblies = [...contract.propellers];
}

export function updateAewModelAnimation(
  model: THREE.Group,
  dt: number,
  radarOperational: boolean,
  speedRatio: number,
) {
  const contract = model.userData.aewModelAnimation as AewModelAnimationContract | undefined;
  if (contract) {
    if (radarOperational) contract.rotodomes.forEach((rotodome) => { rotodome.rotation.y += dt * 0.65; });
    const baseSpeed = 22 + THREE.MathUtils.clamp(speedRatio, 0, 1.35) * 24;
    contract.propellers.forEach((propeller) => {
      propeller.rotors.forEach((rotor) => {
        rotor.object.rotation.z += dt * baseSpeed * rotor.speedScale * rotor.direction;
      });
    });
    return;
  }

  // Compatibility for recordings or external model builders that still use
  // the original single-group animation metadata.
  const rotodome = model.userData.rotodome as THREE.Group | undefined;
  if (rotodome && radarOperational) rotodome.rotation.y += dt * 0.65;
  const propellers = model.userData.propellers as THREE.Group[] | undefined;
  propellers?.forEach((propeller, index) => {
    propeller.rotation.z += dt * (22 + speedRatio * 24 + index * 0.4);
  });
}
