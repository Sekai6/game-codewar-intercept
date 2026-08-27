import type { CecMeasurement, CecNetworkConfig, CecParticipant, CecCompositeTrack } from "./types.js";
import { CecNetworkRuntime } from "./network-runtime.js";
import { CecFusionRuntime } from "./fusion-runtime.js";

/** Deterministic CEC orchestration layer. It transports measurements and never launches weapons. */
export class CecRuntime {
  readonly network: CecNetworkRuntime;
  readonly fusion = new CecFusionRuntime();
  readonly measurements: CecMeasurement[] = [];
  private readonly pending: CecMeasurement[] = [];
  constructor(config: CecNetworkConfig, seed = 1) { this.network = new CecNetworkRuntime(config, seed); }
  reset(){this.network.reset();this.fusion.reset();this.measurements.length=0;this.pending.length=0;}
  register(participant: CecParticipant) { return this.network.register(participant); }
  ingest(measurement: CecMeasurement, now: number) {
    if (!this.network.roster.some((p) => p.id === measurement.sourcePlatformId)) return 0;
    this.measurements.push(measurement);
    this.pending.push(measurement);
    return this.network.enqueue(measurement.sourcePlatformId, measurement, now);
  }
  update(now: number): CecCompositeTrack[] {
    const result = this.network.deliver(now);
    for (const message of result.delivered) this.pending.push(message.measurement);
    const tracks = this.fusion.ingest(this.pending.splice(0), now);
    this.fusion.tick(now);
    return tracks;
  }
}
