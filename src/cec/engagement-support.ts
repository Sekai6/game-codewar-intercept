import type * as THREE from "three";
import type { CecCompositeTrack, CecEngagementSupport } from "./types.js";

export interface CecShooterCandidate {
  id: string;
  side: "blue" | "red";
  position: THREE.Vector3;
  alive: boolean;
  fireControlChannels: number;
  availableInterceptors: number;
  localFireControlConfirmed: boolean;
  compatibleTargetKinds?: readonly string[];
}

export interface CecFireControlPolicy {
  now: number;
  maxTrackAge: number;
  maxPositionVariance: number;
  maxVelocityVariance: number;
  minimumQuality: number;
  maxRange: number;
  targetKind?: string;
}

export interface CecFireControlDecision {
  allowed: boolean;
  reason?: string;
  support?: CecEngagementSupport;
}

/** Validates remote measurement support without creating a weapon or touching a launcher. */
export function evaluateCecFireControl(
  track: CecCompositeTrack,
  shooter: CecShooterCandidate,
  policy: CecFireControlPolicy,
): CecFireControlDecision {
  if (!shooter.alive) return { allowed: false, reason: "SHOOTER_NOT_ALIVE" };
  if (shooter.side !== "blue") return { allowed: false, reason: "CEC_SHOOTER_NOT_AUTHORIZED" };
  if (shooter.fireControlChannels < 1) return { allowed: false, reason: "LOCAL_CHANNEL_UNAVAILABLE" };
  if (shooter.availableInterceptors < 1) return { allowed: false, reason: "NO_INTERCEPTOR_AVAILABLE" };
  if (!shooter.localFireControlConfirmed) return { allowed: false, reason: "LOCAL_FIRE_CONTROL_REQUIRED" };
  const age = Math.max(0, policy.now - track.lastMeasurementAt);
  if (age > policy.maxTrackAge) return { allowed: false, reason: "TRACK_EXPIRED" };
  if (track.quality < policy.minimumQuality) return { allowed: false, reason: "TRACK_QUALITY_TOO_LOW" };
  const variance = track.covariance.positionVariance;
  const velocityVariance = track.covariance.velocityVariance;
  if (variance > policy.maxPositionVariance || velocityVariance > policy.maxVelocityVariance)
    return { allowed: false, reason: "COVARIANCE_TOO_HIGH" };
  if (track.position.distanceTo(shooter.position) > policy.maxRange)
    return { allowed: false, reason: "OUT_OF_RANGE" };
  if (policy.targetKind && shooter.compatibleTargetKinds && !shooter.compatibleTargetKinds.includes(policy.targetKind))
    return { allowed: false, reason: "TARGET_TYPE_NOT_COMPATIBLE" };
  const support: CecEngagementSupport = {
    shooterId: shooter.id,
    targetId: track.targetId,
    compositeTrackId: track.id,
    authorizedAt: policy.now,
    expiresAt: policy.now + policy.maxTrackAge,
    supportingMeasurements: [...track.contributors],
    localFireControlConfirmed: true,
    midcourseUpdateAllowed: true,
  };
  return { allowed: true, support };
}

export interface CecAssignment { targetId: string; primaryShooterId: string; backupShooterId?: string; }

/** Deterministic primary/backup allocation; assignment does not launch or reserve ammunition. */
export function assignCecShooters(
  tracks: readonly CecCompositeTrack[],
  shooters: readonly CecShooterCandidate[],
  now: number,
): CecAssignment[] {
  const available = shooters.filter(s => s.alive && s.side === "blue" && s.fireControlChannels > 0 && s.availableInterceptors > 0);
  const results: CecAssignment[] = [];
  for (const track of tracks.filter(t => t.engagementQuality === "weapon")) {
    const ranked = [...available].sort((a, b) => a.position.distanceTo(track.position) - b.position.distanceTo(track.position));
    const primary = ranked[0];
    if (!primary) continue;
    const backup = ranked.find(s => s.id !== primary.id);
    results.push(backup ? { targetId: track.targetId, primaryShooterId: primary.id, backupShooterId: backup.id } : { targetId: track.targetId, primaryShooterId: primary.id });
  }
  return results;
}
