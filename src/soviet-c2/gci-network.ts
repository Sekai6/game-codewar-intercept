import * as THREE from "three";
import type { SovietCommandEra } from "./era.js";
import { SOVIET_COMMAND_ERAS, sovietGciOperational } from "./era.js";
import { evaluatePropagation } from "../space-weather/propagation-effects.js";
import type { SpaceWeatherSnapshot } from "../space-weather/types.js";

export interface GciParticipant {
  id: string;
  platformId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  alive: boolean;
}

export interface GciSensorTarget {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radarCrossSection: number;
  alive: boolean;
}

export interface GciInterceptCommand {
  id: string;
  participantId: string;
  controllerTrackId: string;
  interceptPoint: THREE.Vector3;
  commandedAltitude: number;
  commandedSpeed: number;
  radarActivationRange: number;
  commandMode: "voice" | "automated";
  quality: number;
  uncertainty: number;
  observedAt: number;
  deliveredAt: number;
  expiresAt: number;
}

export interface GciDiagnostics {
  enabled: boolean;
  controller: string;
  queued: number;
  transmitted: number;
  delivered: number;
  dropped: number;
  activeCommands: number;
  meanDelay: number;
}

interface PendingCommand { command: GciInterceptCommand; deliverAt: number; }
export const SOVIET_GCI_CONTROLLER_POSITION = new THREE.Vector3(520, 12, -1180);

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

function controllerTrackId(targetId: string) {
  let hash = 5381;
  for (const character of targetId) hash = Math.imul(hash, 33) ^ character.charCodeAt(0);
  return `GCI-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const PARAMETERS: Record<SovietCommandEra, {
  scanInterval: number; delay: number; commandLife: number; uncertainty: number;
  reliability: number; range: number; controlledFormations: number;
  commandedSpeed: number; radarActivationRange: number;
}> = {
  "early-cold-war": { scanInterval: 9, delay: 5.2, commandLife: 18, uncertainty: 48, reliability: .76, range: 900, controlledFormations: 1, commandedSpeed: 7.2, radarActivationRange: 380 },
  "ocean-navy": { scanInterval: 6, delay: 3.4, commandLife: 16, uncertainty: 34, reliability: .84, range: 980, controlledFormations: 2, commandedSpeed: 7.8, radarActivationRange: 340 },
  "ntu-1980s": { scanInterval: 4, delay: 1.8, commandLife: 13, uncertainty: 21, reliability: .9, range: 1100, controlledFormations: 3, commandedSpeed: 8.4, radarActivationRange: 300 },
  "late-soviet": { scanInterval: 2.8, delay: 1.1, commandLife: 10, uncertainty: 14, reliability: .93, range: 1180, controlledFormations: 4, commandedSpeed: 8.8, radarActivationRange: 260 },
};

function quantizeVoiceIntercept(participant: GciParticipant, interceptPoint: THREE.Vector3) {
  const offset = interceptPoint.clone().sub(participant.position);
  const bearingStep = THREE.MathUtils.degToRad(10);
  const bearing = Math.round(Math.atan2(offset.x, -offset.z) / bearingStep) * bearingStep;
  const range = Math.max(20, Math.round(Math.hypot(offset.x, offset.z) / 25) * 25);
  return participant.position.clone().add(new THREE.Vector3(
    Math.sin(bearing) * range,
    Math.round(offset.y / 10) * 10,
    -Math.cos(bearing) * range,
  ));
}

export class SovietGciNetwork {
  private era: SovietCommandEra = "ntu-1980s";
  private enabled = true;
  private nextScan = 0;
  private serial = 0;
  private pending: PendingCommand[] = [];
  private commands = new Map<string, GciInterceptCommand>();
  private transmitted = 0;
  private delivered = 0;
  private dropped = 0;
  private totalDelay = 0;
  private propagationSnapshot: SpaceWeatherSnapshot | null = null;

  setPropagationSnapshot(snapshot: SpaceWeatherSnapshot | null) { this.propagationSnapshot = snapshot; }

  reset(era: SovietCommandEra = "ntu-1980s", enabled = true) {
    this.era = era;
    this.enabled = enabled;
    this.nextScan = 0;
    this.serial = 0;
    this.pending = [];
    this.commands.clear();
    this.transmitted = this.delivered = this.dropped = this.totalDelay = 0;
  }

  configure(era: SovietCommandEra, enabled: boolean) {
    if (era === this.era && enabled === this.enabled) return;
    this.reset(era, enabled);
  }

  update(time: number, participants: readonly GciParticipant[], targets: readonly GciSensorTarget[]) {
    const operational = sovietGciOperational({ era: this.era, enabled: this.enabled });
    if (!operational) {
      this.pending = [];
      this.commands.clear();
      return;
    }
    const parameters = PARAMETERS[this.era];
    for (const [id, command] of this.commands)
      if (time > command.expiresAt || !participants.some((participant) => participant.id === id && participant.alive))
        this.commands.delete(id);
    const due = this.pending.filter((entry) => entry.deliverAt <= time);
    this.pending = this.pending.filter((entry) => entry.deliverAt > time);
    for (const entry of due) {
      if (!participants.some((participant) => participant.id === entry.command.participantId && participant.alive)) {
        this.dropped++;
        continue;
      }
      this.commands.set(entry.command.participantId, entry.command);
      this.delivered++;
      this.totalDelay += entry.command.deliveredAt - entry.command.observedAt;
    }
    if (time + 1e-6 < this.nextScan) return;
    this.nextScan = time + parameters.scanInterval;
    const detected = targets.filter((target) => {
      if (!target.alive) return false;
      const range = SOVIET_GCI_CONTROLLER_POSITION.distanceTo(target.position);
      const rcsFactor = Math.pow(Math.max(.05, target.radarCrossSection / 8), .25);
      const effectiveRange = parameters.range * rcsFactor;
      if (range > effectiveRange) return false;
      const probability = Math.max(.18, .96 - Math.pow(range / effectiveRange, 2) * .72);
      return deterministic(`${this.era}:${target.id}:${Math.floor(time / parameters.scanInterval)}`) < probability;
    });
    const controlledParticipants = participants
      .filter((candidate) => candidate.alive && candidate.platformId === "MIG-29A")
      .sort((left, right) => {
        const leftRange = detected.length ? Math.min(...detected.map((target) => target.position.distanceTo(left.position))) : Infinity;
        const rightRange = detected.length ? Math.min(...detected.map((target) => target.position.distanceTo(right.position))) : Infinity;
        return leftRange - rightRange || left.id.localeCompare(right.id);
      })
      .slice(0, parameters.controlledFormations);
    for (const participant of controlledParticipants) {
      const target = detected
        .map((candidate) => ({ candidate, distance: candidate.position.distanceTo(participant.position) }))
        .sort((left, right) => left.distance - right.distance)[0]?.candidate;
      if (!target) continue;
      const range = SOVIET_GCI_CONTROLLER_POSITION.distanceTo(target.position);
      const quality = THREE.MathUtils.clamp(.88 - range / parameters.range * .42, .25, .86);
      const uncertainty = parameters.uncertainty * (1.15 - quality * .35);
      const attempt = ++this.serial;
      const noiseSeed = `${target.id}:${participant.id}:${attempt}`;
      const measured = target.position.clone().add(new THREE.Vector3(
        (deterministic(`${noiseSeed}:x`) - .5) * uncertainty * 2,
        (deterministic(`${noiseSeed}:y`) - .5) * uncertainty * .45,
        (deterministic(`${noiseSeed}:z`) - .5) * uncertainty * 2,
      ));
      const relativeSpeed = Math.max(3, participant.velocity.length() + target.velocity.length());
      const leadTime = THREE.MathUtils.clamp(participant.position.distanceTo(measured) / relativeSpeed, 8, 55);
      let interceptPoint = measured.addScaledVector(target.velocity, leadTime * .72);
      const commandMode = SOVIET_COMMAND_ERAS[this.era].automaticGci ? "automated" : "voice";
      if (commandMode === "voice") interceptPoint = quantizeVoiceIntercept(participant, interceptPoint);
      const jitter = (deterministic(`${noiseSeed}:delay`) - .5) * parameters.delay * .3;
      const baseDelay = Math.max(.4, parameters.delay + jitter);
      const propagation = this.propagationSnapshot ? evaluatePropagation(this.propagationSnapshot, {
        channel:"soviet-gci",messageId:noiseSeed,senderId:"soviet-gci-controller",recipientId:participant.id,
        baseQuality:quality,baseDelaySeconds:baseDelay,baseSuccessProbability:parameters.reliability,
      }) : null;
      if (propagation?.dropped || (!propagation && deterministic(`${noiseSeed}:link`) > parameters.reliability)) {
        this.dropped++;
        continue;
      }
      const delay = propagation?.delaySeconds ?? baseDelay;
      const deliveredAt = time + delay;
      this.pending.push({
        deliverAt: deliveredAt,
        command: {
          id: `GCI-CMD-${attempt}`,
          participantId: participant.id,
          controllerTrackId: controllerTrackId(target.id),
          interceptPoint,
          commandedAltitude: THREE.MathUtils.clamp(
            commandMode === "voice" ? Math.round((interceptPoint.y + 4) / 10) * 10 : interceptPoint.y + 4,
            24,
            110,
          ),
          commandedSpeed: parameters.commandedSpeed,
          radarActivationRange: parameters.radarActivationRange,
          commandMode,
          quality: quality * (propagation?.qualityMultiplier ?? 1),
          uncertainty: uncertainty * (propagation?.uncertaintyMultiplier ?? 1),
          observedAt: time,
          deliveredAt,
          expiresAt: deliveredAt + parameters.commandLife,
        },
      });
      this.transmitted++;
    }
  }

  commandFor(participantId: string, time: number) {
    const command = this.commands.get(participantId);
    return command && time <= command.expiresAt ? command : undefined;
  }

  diagnostics(time: number): GciDiagnostics {
    return {
      enabled: sovietGciOperational({ era: this.era, enabled: this.enabled }),
      controller: "SECTOR GCI-1",
      queued: this.pending.length,
      transmitted: this.transmitted,
      delivered: this.delivered,
      dropped: this.dropped,
      activeCommands: [...this.commands.values()].filter((command) => command.expiresAt >= time).length,
      meanDelay: this.delivered ? this.totalDelay / this.delivered : 0,
    };
  }
}
