import * as THREE from "three";

export interface AssetDetailLodRegistration {
  nearDistance: number;
  mediumDistance: number;
  high: readonly THREE.Object3D[];
  medium?: readonly THREE.Object3D[];
}

export function registerAssetDetailLod(root: THREE.Object3D, registration: AssetDetailLodRegistration) {
  root.userData.assetDetailLod = registration;
}

export function updateRegisteredAssetDetailLods(root: THREE.Object3D, cameraPosition: THREE.Vector3) {
  const worldPosition = new THREE.Vector3();
  root.traverse((object) => {
    const registration = object.userData.assetDetailLod as AssetDetailLodRegistration | undefined;
    if (!registration) return;
    object.getWorldPosition(worldPosition);
    const distance = worldPosition.distanceTo(cameraPosition);
    const highVisible = distance < registration.nearDistance;
    const mediumVisible = distance < registration.mediumDistance;
    registration.high.forEach((detail) => { detail.visible = highVisible; });
    registration.medium?.forEach((detail) => { detail.visible = mediumVisible; });
  });
}
