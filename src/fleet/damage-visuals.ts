import * as THREE from "three";
import type { ShipCombatantInstance } from "../ships/types.js";

type DamageVisualModel = THREE.Group & {
  userData: {
    smokePuffs?: THREE.Mesh[];
    hullMat?: THREE.MeshStandardMaterial;
  };
};

export class FleetDamageVisuals {
  private readonly baseHullColors = new Map<string, THREE.Color>();

  update(ships: readonly ShipCombatantInstance[], time: number) {
    for (const ship of ships) {
      const model = ship.model as DamageVisualModel;
      const puffs = model.userData.smokePuffs ?? [];
      const fire = THREE.MathUtils.clamp(ship.damageControl.fireIntensity / 55, 0, 1);
      const flooding = THREE.MathUtils.clamp(ship.damageControl.flooding / 70, 0, 1);
      puffs.forEach((puff, index) => {
        const material = puff.material as THREE.MeshBasicMaterial;
        const phase = (time * (0.2 + fire * 0.3) + index / Math.max(1, puffs.length)) % 1;
        puff.visible = fire > 0.03;
        puff.scale.setScalar((0.55 + phase * 1.8) * (0.45 + fire * 0.8));
        material.opacity = 0.13 * fire * (1 - phase * 0.65);
      });
      const hullMat = model.userData.hullMat;
      if (!hullMat) continue;
      let base = this.baseHullColors.get(ship.id);
      if (!base) {
        base = hullMat.color.clone();
        this.baseHullColors.set(ship.id, base);
      }
      hullMat.color.copy(base).lerp(new THREE.Color(0x352d2a), Math.max(fire * 0.42, flooding * 0.18));
    }
  }

  reset(ships: readonly ShipCombatantInstance[]) {
    for (const ship of ships) {
      const model = ship.model as DamageVisualModel;
      for (const puff of model.userData.smokePuffs ?? []) {
        puff.visible = false;
        (puff.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      const hullMat = model.userData.hullMat;
      const base = this.baseHullColors.get(ship.id);
      if (hullMat && base) hullMat.color.copy(base);
    }
  }

  dispose() { this.baseHullColors.clear(); }
}
