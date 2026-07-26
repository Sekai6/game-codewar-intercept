import * as THREE from "three";

export type AssetDetailQuality = "low" | "high" | "ultra";

export interface AssetDetailLodRegistration {
  nearDistance: number;
  mediumDistance: number;
  high: readonly THREE.Object3D[];
  medium?: readonly THREE.Object3D[];
  low?: readonly THREE.Object3D[];
  persistentUntilMedium?: readonly THREE.Object3D[];
  exclusiveTiers?: boolean;
  qualityAware?: boolean;
}

export function registerAssetDetailLod(root: THREE.Object3D, registration: AssetDetailLodRegistration) {
  root.userData.assetDetailLod = registration;
}

export function updateRegisteredAssetDetailLods(
  root: THREE.Object3D,
  cameraPosition: THREE.Vector3,
  quality: AssetDetailQuality = "ultra",
) {
  const worldPosition = new THREE.Vector3();
  root.traverse((object) => {
    const registration = object.userData.assetDetailLod as AssetDetailLodRegistration | undefined;
    if (!registration) return;
    object.getWorldPosition(worldPosition);
    const distance = worldPosition.distanceTo(cameraPosition);
    let highVisible = distance < registration.nearDistance;
    let mediumVisible = registration.exclusiveTiers
      ? distance >= registration.nearDistance && distance < registration.mediumDistance
      : distance < registration.mediumDistance;
    let lowVisible = distance >= registration.mediumDistance;
    if (registration.qualityAware) {
      if (quality === "low") {
        highVisible = false;
        mediumVisible = false;
        lowVisible = true;
      } else if (quality === "high") {
        highVisible = false;
        mediumVisible = distance < registration.mediumDistance;
        lowVisible = !mediumVisible;
      }
    }
    registration.high.forEach((detail) => { detail.visible = highVisible; });
    registration.medium?.forEach((detail) => { detail.visible = mediumVisible; });
    registration.low?.forEach((detail) => { detail.visible = lowVisible; });
    registration.persistentUntilMedium?.forEach((detail) => { detail.visible = !lowVisible; });
  });
}
