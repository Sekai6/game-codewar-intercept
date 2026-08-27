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
  private trackIds = new Set<string>();

  reset() {
    this.activityIds.clear();
    this.previousConfiguration = "";
    this.previousNcs = undefined;
    this.trackIds.clear();
  }

  sample(observation: TacticalNetworkObservation, time: number): DatalinkAarSample {
    const events: AarEvent[] = [];
    const configuration = `${observation.era}|${observation.enabled}`;
    if (configuration !== this.previousConfiguration) {
      events.push({
        time,
        category: "network",
        text: `TACTICAL NETWORK / ERA ${observation.era.toUpperCase()} / ${observation.enabled ? "ENABLED" : "DISCONNECTED"}`,
      });
      this.previousConfiguration = configuration;
    }
    const ncs = observation.link11.netControlStation;
    if (this.previousNcs !== undefined && ncs !== this.previousNcs)
      events.push({
        time,
        category: "network",
        text: `LINK 11 NCS CHANGE / ${this.previousNcs ?? "NONE"} -> ${ncs ?? "NONE"}`,
      });
    this.previousNcs = ncs;

    for (const activity of observation.activities) {
      if (this.activityIds.has(activity.id)) continue;
      this.activityIds.add(activity.id);
      const route = activity.recipientId
        ? `${activity.senderId} -> ${activity.recipientId}`
        : activity.senderId;
      const detail = [activity.trackId && `TRACK ${activity.trackId}`, activity.delay !== undefined && `DELAY ${activity.delay.toFixed(2)}s`, activity.reason && `REASON ${activity.reason.toUpperCase()}`]
        .filter(Boolean).join(" / ");
      events.push({
        time: activity.time,
        category: "network",
        text: `${activity.network.toUpperCase()} ${activity.kind.toUpperCase()} / ${route}${detail ? ` / ${detail}` : ""}`,
      });
    }
    for (const track of observation.tracks) {
      if (this.trackIds.has(track.id)) continue;
      this.trackIds.add(track.id);
      if (track.passive || track.sensorMode === "irst" || track.sensorMode === "esm" || track.sensorMode === "passive-fusion") {
        events.push({
          time,
          category: "network",
          text: `${track.network.toUpperCase()} PASSIVE CUE / TRACK ${track.id} / SOURCE ${(track.sensorMode ?? "PASSIVE").toUpperCase()} / ${track.bearingOnly ? "BEARING-ONLY" : "RANGE ESTIMATE"} / TQ ${Math.round(track.quality * 100)}% / UNC ${track.uncertainty.toFixed(1)}`,
        });
      }
    }
    for (const decision of observation.decisions ?? []) {
      if (this.activityIds.has(decision.id)) continue;
      this.activityIds.add(decision.id);
      const labels = {
        "cue-accepted-search": "CUE ACCEPTED FOR SEARCH",
        "cue-expired": "CUE EXPIRED",
        "organic-acquisition": "ORGANIC RADAR ACQUISITION AFTER CUE",
        "weapon-authorization-rejected": "CUE REJECTED FOR WEAPON AUTHORIZATION",
      } as const;
      events.push({
        time: decision.time,
        category: "network",
        text: `${decision.network.toUpperCase()} ${labels[decision.kind]} / ${decision.participantId} / TRACK ${decision.trackId}${decision.organicTargetId ? ` / ORGANIC ${decision.organicTargetId}` : ""}`,
      });
    }
    // Bound memory without allowing recent activities to be emitted twice.
    if (this.activityIds.size > 4096)
      this.activityIds = new Set([
        ...observation.activities.map((activity) => activity.id),
        ...(observation.decisions ?? []).map((decision) => decision.id),
      ]);

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
