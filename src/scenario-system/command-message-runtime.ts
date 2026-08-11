import type { ScenarioCommandMessageDefinition } from "./types.js";

export type ScenarioCommandOutcome = "acted" | "rejected" | "stale" | "insufficient-quality";
export interface ScenarioCommandDelivery {
  definition: ScenarioCommandMessageDefinition;
  deliveredAt: number;
  outcome: ScenarioCommandOutcome;
  reason: string;
}

export class ScenarioCommandMessageRuntime {
  private readonly delivered = new Set<string>();
  private readonly queued = new Set<string>();
  constructor(private readonly definitions: readonly ScenarioCommandMessageDefinition[]) {}
  reset() { this.delivered.clear(); this.queued.clear(); }
  update(time: number, handler: (message: ScenarioCommandMessageDefinition) => Omit<ScenarioCommandDelivery, "definition" | "deliveredAt">) {
    const queued: ScenarioCommandMessageDefinition[] = [];
    const deliveries: ScenarioCommandDelivery[] = [];
    for (const message of this.definitions) {
      if (time >= message.createdAt && !this.queued.has(message.id)) {
        this.queued.add(message.id); queued.push(message);
      }
      if (time < message.deliverAt || this.delivered.has(message.id)) continue;
      this.delivered.add(message.id);
      const result = time > message.expiresAt
        ? { outcome: "stale" as const, reason: "delivery-window-expired" }
        : handler(message);
      deliveries.push({ definition: message, deliveredAt: time, ...result });
    }
    return { queued, deliveries };
  }
}
