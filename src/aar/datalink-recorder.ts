import type { AarDatalinkSnapshot, AarEvent } from "../combat-types.js";
import type { TacticalNetworkObservation } from "../datalink/observability.js";

export interface DatalinkAarSample {
  snapshot: AarDatalinkSnapshot;
  events: AarEvent[];
}

export class DatalinkAarRecorder {
  private activityIds = new Set<string>();
  private previousConfiguration = "";
  private previousNcs: string | null | undefined;

  reset() {
    this.activityIds.clear();
    this.previousConfiguration = "";
    this.previousNcs = undefined;
  }

  sample(observation: TacticalNetworkObservation, time: number): DatalinkAarSample {
    const events: AarEvent[] = [];
    const configuration = `${observation.era}|${observation.enabled}`;
    if (configuration !== this.previousConfiguration) {
      events.push({
        time,
        category: "guidance",
        text: `TACTICAL NETWORK / ERA ${observation.era.toUpperCase()} / ${observation.enabled ? "ENABLED" : "DISCONNECTED"}`,
      });
      this.previousConfiguration = configuration;
    }
    const ncs = observation.link11.netControlStation;
    if (this.previousNcs !== undefined && ncs !== this.previousNcs)
      events.push({
        time,
        category: "guidance",
        text: `LINK 11 NCS CHANGE / ${this.previousNcs ?? "NONE"} -> ${ncs ?? "NONE"}`,
      });
    this.previousNcs = ncs;

    for (const activity of observation.activities) {
      if (this.activityIds.has(activity.id)) continue;
      this.activityIds.add(activity.id);
      const route = activity.recipientId
        ? `${activity.senderId} -> ${activity.recipientId}`
        : activity.senderId;
      const detail = [activity.trackId && `TRACK ${activity.trackId}`, activity.delay !== undefined && `DELAY ${activity.delay.toFixed(2)}s`]
        .filter(Boolean).join(" / ");
      events.push({
        time: activity.time,
        category: "guidance",
        text: `${activity.network.toUpperCase()} ${activity.kind.toUpperCase()} / ${route}${detail ? ` / ${detail}` : ""}`,
      });
    }
    // Bound memory without allowing recent activities to be emitted twice.
    if (this.activityIds.size > 4096)
      this.activityIds = new Set(observation.activities.map((activity) => activity.id));

    return {
      events: events.sort((a, b) => a.time - b.time),
      snapshot: {
        era: observation.era,
        enabled: observation.enabled,
        link11Ncs: ncs,
        link11CycleSeconds: observation.link11.cycleSeconds,
        nodes: observation.nodes.map((node) => ({
          id: node.id,
          network: node.network,
          x: node.position.x,
          y: node.position.y,
          z: node.position.z,
          role: node.role,
          terminalHealth: node.terminalHealth,
          transmitEnabled: node.transmitEnabled,
          receiveEnabled: node.receiveEnabled,
        })),
        tracks: observation.tracks.map((track) => ({
          id: track.id,
          network: track.network,
          x: track.position.x,
          y: track.position.y,
          z: track.position.z,
          classification: track.classification,
          quality: track.quality,
          uncertainty: track.uncertainty,
          age: track.age,
          senderId: track.senderId,
        })),
      },
    };
  }
}
