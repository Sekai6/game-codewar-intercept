import type * as THREE from "three";

export type CombatSide = "blue" | "red";
export type CombatEntityKind = "ship" | "aircraft" | "missile" | "decoy";

export interface CombatEntity {
  id: string;
  side: CombatSide;
  kind: CombatEntityKind;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radarCrossSection: number;
  infraredSignature: number;
  alive: boolean;
  /** Unified radiation state consumed by ESM; omitted means non-emitting. */
  emissionState?: import("./sensors/passive-types.js").EmissionState;
}

export interface TargetableEntity extends CombatEntity {
  applyDamage: (damage: number, hitPoint: THREE.Vector3) => void;
}
