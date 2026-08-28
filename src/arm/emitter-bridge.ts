import type { CombatEntity } from "../combat-entity.js";
import type { EmitterInstance } from "./types.js";

/** Creates a transient emitter view from an existing platform radiation state.
 * Persistent multi-radar emitters will be added by the ship sensor adapter;
 * this bridge keeps ARM compatible with current platform entities. */
export function emitterFromEntity(entity: CombatEntity, time: number, band = "X"): EmitterInstance | undefined {
  const radiation = entity.emissionState;
  if (!radiation || (!radiation.radarEmitting && !radiation.jammerEmitting)) return undefined;
  return {
    id: `${entity.id}:emitter`, platformId: entity.id, definitionId: `${entity.kind}-runtime-emitter`,
    position: entity.position.clone(), active: true,
    mode: radiation.jammerEmitting ? "jam" : radiation.radarEmitting ? "guidance" : "search",
    emissionStrength: radiation.emissionStrength, lastActivatedAt: time, lastDeactivatedAt: 0,
    health: entity.alive ? 1 : 0, decoy: false, band,
  };
}
