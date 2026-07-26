import * as THREE from "three";

export interface AirWeaponAttachmentStation {
  id: string;
  position: readonly [number, number, number];
}

export function attachAirWeaponModel(
  aircraftModel: THREE.Group,
  station: AirWeaponAttachmentStation,
  weaponModel: THREE.Group,
) {
  const mountedScale = Number(weaponModel.userData.mountedScale ?? 0.72);
  weaponModel.scale.setScalar(mountedScale);
  const visualMounts = aircraftModel.userData.airWeaponMounts as
    | Record<string, THREE.Object3D>
    | undefined;
  const mount = visualMounts?.[station.id];
  if (mount) {
    mount.add(weaponModel);
    weaponModel.position.set(0, 0, 0);
    const upperContactY = Number(mount.userData.weaponUpperContactY);
    const modelContactY = Number(weaponModel.userData.mountContactY);
    if (Number.isFinite(upperContactY) && Number.isFinite(modelContactY)) {
      const overlap = Number(mount.userData.weaponContactOverlap ?? 0);
      weaponModel.position.y = upperContactY + overlap - modelContactY * mountedScale;
    }
    weaponModel.rotation.set(0, 0, Number(mount.userData.weaponRoll ?? 0));
  } else {
    weaponModel.position.set(...station.position);
    aircraftModel.add(weaponModel);
  }
  const flame = weaponModel.userData.flame as THREE.Object3D | undefined;
  if (flame) flame.visible = false;
  return mount ?? aircraftModel;
}
