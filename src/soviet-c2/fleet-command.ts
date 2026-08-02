import * as THREE from "three";
import type { SovietCommandEra } from "./era.js";
import { SOVIET_COMMAND_ERAS } from "./era.js";
import { evaluatePropagation } from "../space-weather/propagation-effects.js";
import type { SpaceWeatherSnapshot } from "../space-weather/types.js";

export interface SovietFleetCommandNode {
  id: string;
  label: string;
  alive: boolean;
  health: number;
}

export interface SovietFleetParticipant {
  id: string;
  platformId: string;
  position: THREE.Vector3;
  alive: boolean;
}

export interface SovietFleetTargetArea {
  reportTrackId: string;
  estimatedPosition: THREE.Vector3;
  launchRegionCenter: THREE.Vector3;
  quality: number;
  observedAt: number;
  expiresAt: number;
}

export interface SovietFleetStrikeOrder {
  id: string;
  participantId: string;
  commandNodeId: string;
  sourceReportTrackId: string;
  mission: "maritime-strike";
  priority: "main-effort" | "supporting-effort";
  approachPoint: THREE.Vector3;
  egressDirection: THREE.Vector3;
  attackWindowStart: number;
  attackWindowEnd: number;
  issuedAt: number;
  deliveredAt: number;
  expiresAt: number;
}

export interface SovietFleetCommandDiagnostics {
  enabled: boolean;
  nodeId: string;
  nodeLabel: string;
  nodeAlive: boolean;
  queued: number;
  transmitted: number;
  delivered: number;
  dropped: number;
  activeOrders: number;
  meanDelay: number;
}

interface PendingOrder { order: SovietFleetStrikeOrder; deliverAt: number }

const PARAMETERS: Record<SovietCommandEra, {
  interval: number;
  delay: number;
  reliability: number;
  orderLife: number;
  windowLead: number;
  windowWidth: number;
}> = {
  "early-cold-war": { interval: 30, delay: 9, reliability: 0.62, orderLife: 30, windowLead: 8, windowWidth: 14 },
  "ocean-navy": { interval: 18, delay: 5.2, reliability: 0.8, orderLife: 34, windowLead: 6, windowWidth: 14 },
  "ntu-1980s": { interval: 13, delay: 3.2, reliability: 0.88, orderLife: 30, windowLead: 4, windowWidth: 13 },
  "late-soviet": { interval: 10, delay: 2.2, reliability: 0.92, orderLife: 26, windowLead: 3, windowWidth: 12 },
};

function deterministic(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

export class SovietFleetCommandNetwork {
  private era: SovietCommandEra = "ntu-1980s";
  private enabled = true;
  private nextCommand = 0;
  private serial = 0;
  private pending: PendingOrder[] = [];
  private orders = new Map<string, SovietFleetStrikeOrder>();
  private node: SovietFleetCommandNode = {
    id: "soviet-fleet-command-post",
    label: "FLEET COMMAND POST",
    alive: true,
    health: 1,
  };
  private transmitted = 0;
  private delivered = 0;
  private dropped = 0;
  private totalDelay = 0;
  private propagationSnapshot: SpaceWeatherSnapshot | null = null;

  setPropagationSnapshot(snapshot: SpaceWeatherSnapshot | null) { this.propagationSnapshot = snapshot; }

  reset(era: SovietCommandEra = "ntu-1980s", enabled = true) {
    this.era = era;
    this.enabled = enabled;
    this.nextCommand = 0;
    this.serial = 0;
    this.pending = [];
    this.orders.clear();
    this.transmitted = this.delivered = this.dropped = this.totalDelay = 0;
  }

  configure(era: SovietCommandEra, enabled: boolean) {
    if (era === this.era && enabled === this.enabled) return;
    this.reset(era, enabled);
  }

  update(
    time: number,
    node: SovietFleetCommandNode,
    participants: readonly SovietFleetParticipant[],
    targetAreas: ReadonlyMap<string, SovietFleetTargetArea>,
  ) {
    this.node = { ...node, health: THREE.MathUtils.clamp(node.health, 0, 1) };
    const operational = this.enabled && SOVIET_COMMAND_ERAS[this.era].fleetCommandAvailable;
    if (!operational) {
      this.pending = [];
      this.orders.clear();
      return;
    }
    for (const [participantId, order] of this.orders) {
      if (time > order.expiresAt || !participants.some((participant) => participant.id === participantId && participant.alive))
        this.orders.delete(participantId);
    }
    const due = this.pending.filter((entry) => entry.deliverAt <= time);
    this.pending = this.pending.filter((entry) => entry.deliverAt > time);
    for (const entry of due) {
      if (!participants.some((participant) => participant.id === entry.order.participantId && participant.alive)) {
        this.dropped++;
        continue;
      }
      this.orders.set(entry.order.participantId, entry.order);
      this.delivered++;
      this.totalDelay += entry.order.deliveredAt - entry.order.issuedAt;
    }
    if (!node.alive || node.health <= 0.05 || time + 1e-6 < this.nextCommand) return;
    const parameters = PARAMETERS[this.era];
    const eligibleParticipants = participants.filter((candidate) =>
      candidate.alive && candidate.platformId === "TU-16K" &&
      !!targetAreas.get(candidate.id) && time <= targetAreas.get(candidate.id)!.expiresAt);
    if (!eligibleParticipants.length) return;
    this.nextCommand = time + parameters.interval;
    for (const participant of eligibleParticipants) {
      const area = targetAreas.get(participant.id);
      if (!area || time > area.expiresAt) continue;
      const attempt = ++this.serial;
      const seed = `${this.era}:${node.id}:${participant.id}:${area.reportTrackId}:${attempt}`;
      const linkReliability = parameters.reliability * (0.55 + node.health * 0.45);
      this.transmitted++;
      const baseDelay = Math.max(0.8, parameters.delay * (0.88 + deterministic(`${seed}:delay`) * 0.24));
      const propagation = this.propagationSnapshot ? evaluatePropagation(this.propagationSnapshot, {
        channel:"soviet-maritime-c2",messageId:seed,senderId:node.id,recipientId:participant.id,
        baseDelaySeconds:baseDelay,baseSuccessProbability:linkReliability,baseQuality:area.quality,
      }) : null;
      if (propagation?.dropped || (!propagation && deterministic(`${seed}:link`) > linkReliability)) {
        this.dropped++;
        continue;
      }
      const delay = propagation?.delaySeconds ?? baseDelay;
      const inbound = area.estimatedPosition.clone().sub(participant.position).setY(0);
      if (inbound.lengthSq() < 1e-6) inbound.set(0, 0, 1);
      inbound.normalize();
      const lateral = new THREE.Vector3(-inbound.z, 0, inbound.x);
      const flank = (deterministic(`${seed}:flank`) < 0.5 ? -1 : 1) * (35 + (1 - area.quality) * 45);
      const approachPoint = area.launchRegionCenter.clone().addScaledVector(lateral, flank);
      const egressDirection = inbound.clone().multiplyScalar(-1).addScaledVector(lateral, Math.sign(flank) * 0.35).normalize();
      const deliveredAt = time + delay;
      const attackWindowStart = deliveredAt + parameters.windowLead;
      const order: SovietFleetStrikeOrder = {
        id: `FLEET-ORDER-${attempt}`,
        participantId: participant.id,
        commandNodeId: node.id,
        sourceReportTrackId: area.reportTrackId,
        mission: "maritime-strike",
        priority: "main-effort",
        approachPoint,
        egressDirection,
        attackWindowStart,
        attackWindowEnd: attackWindowStart + parameters.windowWidth,
        issuedAt: time,
        deliveredAt,
        expiresAt: deliveredAt + parameters.orderLife,
      };
      this.pending.push({ order, deliverAt: deliveredAt });
    }
  }

  orderFor(participantId: string, time: number) {
    const order = this.orders.get(participantId);
    return order && time <= order.expiresAt ? order : undefined;
  }

  diagnostics(time: number): SovietFleetCommandDiagnostics {
    const operational = this.enabled && SOVIET_COMMAND_ERAS[this.era].fleetCommandAvailable;
    return {
      enabled: operational,
      nodeId: this.node.id,
      nodeLabel: this.node.label,
      nodeAlive: this.node.alive && this.node.health > 0.05,
      queued: this.pending.length,
      transmitted: this.transmitted,
      delivered: this.delivered,
      dropped: this.dropped,
      activeOrders: [...this.orders.values()].filter((order) => order.expiresAt >= time).length,
      meanDelay: this.delivered ? this.totalDelay / this.delivered : 0,
    };
  }
}
