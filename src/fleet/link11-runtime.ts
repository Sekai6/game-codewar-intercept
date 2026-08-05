import { Link11Network } from "../datalink/link11-network.js";
import type { Link11Diagnostics, Link16TrackReport, TacticalNetworkActivity } from "../datalink/types.js";
import type { ShipTrackEstimate } from "../ships/types.js";
import { shipLink11Eligible } from "../datalink/era.js";
import { buildForcePicture } from "./force-picture.js";
import type { NavalForceRuntime } from "./types.js";
import type { PropagationSpatialZone, SpaceWeatherSnapshot } from "../space-weather/types.js";
import { ConflictTrackFusionRuntime } from "../tracks/conflict-fusion.js";

function opaqueTrackNumber(senderId: string, targetId: string) {
  let hash = 2166136261;
  for (const char of `${senderId}:${targetId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `FJ-${String(hash >>> 0).padStart(10, "0").slice(-6)}`;
}

export class FleetLink11Runtime {
  private readonly network = new Link11Network();
  private readonly published = new Map<string, number>();
  private readonly deferred = new Map<string, {
    senderId: string;
    report: Omit<Link16TrackReport,"messageId"|"senderId"|"side"|"transmittedAt">;
    queuedAt: number;
  }>();
  private enabled = false;
  private readonly fusion = new ConflictTrackFusionRuntime();

  setPropagationSnapshot(snapshot: SpaceWeatherSnapshot | null) {
    this.network.setPropagationSnapshot(snapshot);
  }
  setPropagationZones(zones: readonly PropagationSpatialZone[]) { this.network.setPropagationZones(zones); }

  update(force: NavalForceRuntime, now: number, dataLinkEnabled: boolean) {
    const operational = shipLink11Eligible({ era: force.datalinkEra, enabled: dataLinkEnabled });
    if (!operational) {
      if (this.enabled) this.reset(force);
      this.enabled = false;
      return;
    }
    this.enabled = true;
    const otc = force.commandRoles.get("otc");
    for (const ship of force.ships.values()) {
      const hullFactor = Math.max(0, ship.hullIntegrity / 100);
      const terminalHealth = Math.min(
        hullFactor,
        (ship.subsystemHealth.get("fireControl") ?? 0) / 100,
      );
      const connected = force.shipComms.get(ship.id)?.connected !== false;
      this.network.upsertParticipant({
        id: ship.id,
        side: ship.side,
        position: ship.position,
        alive: ship.alive,
        terminalHealth,
        timeSyncQuality: 0.68,
        transmitEnabled: ship.alive && connected,
        receiveEnabled: ship.alive && connected,
        netControlCapable: ship.id === otc,
      });
      for (const track of ship.localTracks.values()) {
        const observationId = `${ship.id}:${opaqueTrackNumber(ship.id, track.targetId)}:${track.updatedAt.toFixed(3)}`;
        const publishKey = `${ship.id}:${observationId}`;
        if (this.published.has(publishKey) || this.deferred.has(publishKey)) continue;
        const report = {
          trackId: opaqueTrackNumber(ship.id, track.targetId),
          originSensorId: `${ship.id}:organic-radar`,
          observationId,
          relayChain: [],
          observedAt: track.updatedAt,
          position: track.position,
          velocity: track.velocity,
          classification: track.classification,
          quality: track.quality,
          uncertainty: track.uncertainty,
          priority: track.classification === "missile" ? "emergency" : "routine",
        } as const;
        if (connected && this.network.publishTrack(ship.id, report, now)) this.published.set(publishKey, now);
        else {
          this.deferred.set(publishKey, { senderId:ship.id, report, queuedAt:now });
          const senderBacklog = [...this.deferred.entries()]
            .filter(([, item]) => item.senderId === ship.id)
            .sort((a, b) => a[1].queuedAt - b[1].queuedAt);
          while (senderBacklog.length > 12) {
            const [oldestKey] = senderBacklog.shift()!;
            this.deferred.delete(oldestKey);
          }
        }
      }
    }
    for (const [key, item] of this.deferred) {
      if (force.shipComms.get(item.senderId)?.connected === false) continue;
      if (!this.network.publishTrack(item.senderId, item.report, now)) continue;
      this.published.set(key, now);
      this.deferred.delete(key);
    }
    this.network.update(now);
    for (const ship of force.ships.values()) {
      if (force.shipComms.get(ship.id)?.connected === false) ship.networkTracks.clear();
      for (const delivery of this.network.drainInbox(ship.id)) {
        const report = delivery.report;
        const age = Math.max(0, now - report.observedAt);
        const track: ShipTrackEstimate = {
          targetId: `link11:${report.trackId}`,
          position: report.position.clone().addScaledVector(report.velocity, age),
          velocity: report.velocity.clone(),
          quality: Math.max(0.03, Math.min(0.58, report.quality * 0.68 - age * 0.025)),
          uncertainty: report.uncertainty + age * 280,
          classification: report.classification,
          source: "link11",
          updatedAt: report.observedAt,
          weaponQuality: false,
        };
        ship.networkTracks.set(track.targetId, track);
      }
      for (const [id, track] of ship.networkTracks)
        if (track.source === "link11" && now - track.updatedAt > 24) ship.networkTracks.delete(id);
    }
    for (const [key, publishedAt] of this.published)
      if (now - publishedAt > 30) this.published.delete(key);
    for (const [key, item] of this.deferred)
      if (now - item.queuedAt > 900) this.deferred.delete(key);
    buildForcePicture(force, now, this.fusion);
  }

  reset(force: NavalForceRuntime) {
    this.network.reset();
    this.published.clear();
    this.deferred.clear();
    for (const ship of force.ships.values()) ship.networkTracks.clear();
    force.picture.clear();
    this.fusion.reset();
  }

  diagnostics(): Readonly<Link11Diagnostics> { return this.network.diagnostics(); }
  isEnabled() { return this.enabled; }
  activities(now: number): readonly TacticalNetworkActivity[] { return this.network.recentActivities(now); }
  drainFusionEvents(){return this.fusion.drainEvents();}
}
