import * as THREE from "three";
import type { SovietCommandEra } from "./era.js";
import { SOVIET_COMMAND_ERAS } from "./era.js";

export type SovietMaritimeSource = "uspekh-u" | "legenda";

export interface MaritimeStrikeParticipant {
  id: string;
  platformId: string;
  position: THREE.Vector3;
  alive: boolean;
}

export interface MaritimeReconTarget {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radarCrossSection: number;
  alive: boolean;
}

export interface MaritimeTargetAreaCue {
  id: string;
  participantId: string;
  reportTrackId: string;
  source: SovietMaritimeSource;
  estimatedPosition: THREE.Vector3;
  estimatedVelocity: THREE.Vector3;
  launchRegionCenter: THREE.Vector3;
  uncertaintyMajor: number;
  uncertaintyMinor: number;
  uncertaintyBearing: number;
  quality: number;
  observedAt: number;
  deliveredAt: number;
  expiresAt: number;
}

export interface MaritimeTargetingDiagnostics {
  enabled: boolean;
  sourceAvailable: SovietMaritimeSource | "none";
  passActive: boolean;
  queued: number;
  transmitted: number;
  delivered: number;
  dropped: number;
  activeCues: number;
  meanDelay: number;
}

interface PendingCue { cue: MaritimeTargetAreaCue; deliverAt: number }

const SOURCE_PARAMETERS: Record<SovietMaritimeSource, {
  scanInterval: number;
  delay: number;
  life: number;
  uncertaintyMajor: number;
  uncertaintyMinor: number;
  reliability: number;
}> = {
  "uspekh-u": {
    scanInterval: 15,
    delay: 4.8,
    life: 42,
    uncertaintyMajor: 92,
    uncertaintyMinor: 48,
    reliability: 0.81,
  },
  legenda: {
    scanInterval: 6,
    delay: 7.2,
    life: 55,
    uncertaintyMajor: 58,
    uncertaintyMinor: 32,
    reliability: 0.86,
  },
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

function opaqueTrackId(targetId: string, source: SovietMaritimeSource) {
  let hash = source === "legenda" ? 0x9e3779b9 : 5381;
  for (const character of targetId) hash = Math.imul(hash, 33) ^ character.charCodeAt(0);
  return `${source === "legenda" ? "RORSAT" : "MRSC"}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function legendaPassActive(time: number) {
  return time % 52 < 9;
}

export class SovietMaritimeTargetingNetwork {
  private era: SovietCommandEra = "ntu-1980s";
  private enabled = true;
  private nextScan = 0;
  private serial = 0;
  private pending: PendingCue[] = [];
  private cues = new Map<string, MaritimeTargetAreaCue>();
  private transmitted = 0;
  private delivered = 0;
  private dropped = 0;
  private totalDelay = 0;

  reset(era: SovietCommandEra = "ntu-1980s", enabled = true) {
    this.era = era;
    this.enabled = enabled;
    this.nextScan = 0;
    this.serial = 0;
    this.pending = [];
    this.cues.clear();
    this.transmitted = this.delivered = this.dropped = this.totalDelay = 0;
  }

  configure(era: SovietCommandEra, enabled: boolean) {
    if (era === this.era && enabled === this.enabled) return;
    this.reset(era, enabled);
  }

  update(
    time: number,
    participants: readonly MaritimeStrikeParticipant[],
    targets: readonly MaritimeReconTarget[],
  ) {
    const capabilities = SOVIET_COMMAND_ERAS[this.era];
    const operational = this.enabled && capabilities.uspekhAvailable;
    if (!operational) {
      this.pending = [];
      this.cues.clear();
      return;
    }
    for (const [id, cue] of this.cues) {
      if (time > cue.expiresAt || !participants.some((participant) => participant.id === id && participant.alive))
        this.cues.delete(id);
    }
    const due = this.pending.filter((entry) => entry.deliverAt <= time);
    this.pending = this.pending.filter((entry) => entry.deliverAt > time);
    for (const entry of due) {
      if (!participants.some((participant) => participant.id === entry.cue.participantId && participant.alive)) {
        this.dropped++;
        continue;
      }
      this.cues.set(entry.cue.participantId, entry.cue);
      this.delivered++;
      this.totalDelay += entry.cue.deliveredAt - entry.cue.observedAt;
    }
    if (time + 1e-6 < this.nextScan) return;
    const passActive = capabilities.legendaAvailable && legendaPassActive(time);
    const source: SovietMaritimeSource = passActive ? "legenda" : "uspekh-u";
    const parameters = SOURCE_PARAMETERS[source];
    this.nextScan = time + parameters.scanInterval;
    for (const participant of participants.filter((candidate) =>
      candidate.alive && candidate.platformId === "TU-16K")) {
      const target = targets.filter((candidate) => candidate.alive)
        .map((candidate) => ({ candidate, distance: candidate.position.distanceTo(participant.position) }))
        .sort((left, right) => left.distance - right.distance)[0]?.candidate;
      if (!target) continue;
      const attempt = ++this.serial;
      const seed = `${this.era}:${source}:${target.id}:${participant.id}:${attempt}`;
      const detected = deterministic(`${seed}:detect`) < parameters.reliability;
      if (!detected) {
        this.dropped++;
        continue;
      }
      const rcsQuality = THREE.MathUtils.clamp(Math.pow(Math.max(0.05, target.radarCrossSection / 12000), 0.25), 0.22, 1);
      const quality = THREE.MathUtils.clamp((source === "legenda" ? 0.67 : 0.55) * (0.72 + rcsQuality * 0.28), 0.28, 0.72);
      const major = parameters.uncertaintyMajor * (1.18 - quality * 0.35);
      const minor = parameters.uncertaintyMinor * (1.15 - quality * 0.3);
      const bearing = deterministic(`${seed}:bearing`) * Math.PI * 2;
      const majorNoise = (deterministic(`${seed}:major`) - 0.5) * major * 2;
      const minorNoise = (deterministic(`${seed}:minor`) - 0.5) * minor * 2;
      const majorAxis = new THREE.Vector3(Math.sin(bearing), 0, Math.cos(bearing));
      const minorAxis = new THREE.Vector3(majorAxis.z, 0, -majorAxis.x);
      const measuredPosition = target.position.clone()
        .addScaledVector(majorAxis, majorNoise)
        .addScaledVector(minorAxis, minorNoise);
      const velocityError = (1 - quality) * 1.4;
      const measuredVelocity = target.velocity.clone().add(new THREE.Vector3(
        (deterministic(`${seed}:vx`) - 0.5) * velocityError,
        0,
        (deterministic(`${seed}:vz`) - 0.5) * velocityError,
      ));
      const jitter = (deterministic(`${seed}:delay`) - 0.5) * parameters.delay * 0.3;
      const delay = Math.max(1, parameters.delay + jitter);
      const predictedPosition = measuredPosition.clone().addScaledVector(measuredVelocity, delay + 12);
      const inbound = predictedPosition.clone().sub(participant.position).setY(0);
      if (inbound.lengthSq() < 1e-6) inbound.set(0, 0, 1);
      inbound.normalize();
      const launchRegionCenter = predictedPosition.clone().addScaledVector(inbound, -420);
      launchRegionCenter.y = participant.position.y;
      const deliveredAt = time + delay;
      const cue: MaritimeTargetAreaCue = {
        id: `MARITIME-CUE-${attempt}`,
        participantId: participant.id,
        reportTrackId: opaqueTrackId(target.id, source),
        source,
        estimatedPosition: predictedPosition,
        estimatedVelocity: measuredVelocity,
        launchRegionCenter,
        uncertaintyMajor: major,
        uncertaintyMinor: minor,
        uncertaintyBearing: bearing,
        quality,
        observedAt: time,
        deliveredAt,
        expiresAt: deliveredAt + parameters.life,
      };
      this.pending.push({ cue, deliverAt: deliveredAt });
      this.transmitted++;
    }
  }

  cueFor(participantId: string, time: number) {
    const cue = this.cues.get(participantId);
    return cue && time <= cue.expiresAt ? cue : undefined;
  }

  diagnostics(time: number): MaritimeTargetingDiagnostics {
    const capabilities = SOVIET_COMMAND_ERAS[this.era];
    const operational = this.enabled && capabilities.uspekhAvailable;
    const passActive = operational && capabilities.legendaAvailable && legendaPassActive(time);
    return {
      enabled: operational,
      sourceAvailable: !operational ? "none" : passActive ? "legenda" : "uspekh-u",
      passActive,
      queued: this.pending.length,
      transmitted: this.transmitted,
      delivered: this.delivered,
      dropped: this.dropped,
      activeCues: [...this.cues.values()].filter((cue) => cue.expiresAt >= time).length,
      meanDelay: this.delivered ? this.totalDelay / this.delivered : 0,
    };
  }
}
