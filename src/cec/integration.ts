import type { CecCompositeTrack, CecNetworkConfig, CecParticipant } from "./types.js";
import { CecRuntime } from "./runtime.js";
import { createCecMeasurement } from "./measurement-runtime.js";

/** Adapter used by the scenario loop: only confirmed local tracks enter CEC. */
export class CecScenarioIntegration {
  readonly runtime: CecRuntime;
  private readonly participantIds = new Set<string>();
  constructor(config: CecNetworkConfig, seed = 1) { this.runtime = new CecRuntime(config, seed); }
  register(participant: CecParticipant) { const ok = this.runtime.register(participant); if (ok) this.participantIds.add(participant.id); return ok; }
  ingestLocalTrack(input: { platformId:string; sensorId:string; targetId:string; position:THREE.Vector3; velocity:THREE.Vector3; classification:string; quality:number; uncertainty:number; observedAt:number; sourceMode:"ship-radar"|"airborne-radar"|"fire-control-radar"|"passive-cue-confirmed"; }, now = input.observedAt) {
    if (!this.participantIds.has(input.platformId) || input.sourceMode === "passive-cue-confirmed" && input.quality < .65) return 0;
    const measurement = createCecMeasurement({ sourcePlatformId: input.platformId, sourceSensorId: input.sensorId, targetId: input.targetId, position: input.position, velocity: input.velocity, classification: input.classification, observedAt: input.observedAt, sourceMode: input.sourceMode, quality: input.quality, covariance: { positionVariance: input.uncertainty ** 2, velocityVariance: Math.max(1, input.uncertainty) ** 2 } });
    return this.runtime.ingest(measurement, now);
  }
  update(now:number): CecCompositeTrack[] { return this.runtime.update(now); }
  get participants() { return [...this.participantIds]; }
}
import type * as THREE from "three";
