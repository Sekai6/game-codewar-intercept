import * as THREE from "three";

export interface NightSubjectFill {
  readonly light: THREE.PointLight;
  setNightFactor(value: number): void;
  update(camera: THREE.Camera): void;
  dispose(): void;
}

export function createNightSubjectFill(scene: THREE.Scene): NightSubjectFill {
  const light = new THREE.PointLight(0x83acd2, 0, 235, 1.65);
  light.name = "camera-local-night-subject-fill";
  light.castShadow = false;
  scene.add(light);
  let nightFactor = 0;

  return {
    light,
    setNightFactor(value) {
      nightFactor = THREE.MathUtils.clamp(value, 0, 1);
      light.intensity = 1.35 * nightFactor;
    },
    update(camera) {
      if (nightFactor <= 0.001) return;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      light.position.copy(camera.position)
        .addScaledVector(forward, 42)
        .add(new THREE.Vector3(0, 46, 0));
    },
    dispose() {
      scene.remove(light);
      light.dispose();
    },
  };
}
