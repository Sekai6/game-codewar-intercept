import type { CecCompositeTrack } from "./types.js";

export interface CecMissileLinkState {
  missileId: string;
  supportsCec: boolean;
  lastUpdateAt: number;
  lastSourcePlatformId?: string;
  updateCount: number;
  maxTrackAge: number;
}

export interface CecMissileUpdate {
  accepted: boolean;
  reason?: string;
  commandPoint?: { x: number; y: number; z: number };
  sourcePlatformId?: string;
  trackId?: string;
}

/** Applies only a midcourse CEC update. It never captures a seeker or creates a missile. */
export function applyCecMidcourseUpdate(
  state: CecMissileLinkState,
  track: CecCompositeTrack | undefined,
  now: number,
): CecMissileUpdate {
  if (!state.supportsCec) return { accepted: false, reason: "WEAPON_CEC_UNSUPPORTED" };
  if (!track) return { accepted: false, reason: "NO_COMPOSITE_TRACK" };
  if (track.engagementQuality !== "weapon" || !track.weaponSupport.allowed)
    return { accepted: false, reason: "TRACK_NOT_WEAPON_GRADE" };
  const age = Math.max(0, now - track.lastMeasurementAt);
  if (age > state.maxTrackAge) return { accepted: false, reason: "TRACK_EXPIRED" };
  if (!track.contributors.length) return { accepted: false, reason: "NO_SUPPORTING_MEASUREMENT" };
  state.lastUpdateAt = now;
  state.lastSourcePlatformId = track.contributors[0];
  state.updateCount += 1;
  return {
    accepted: true,
    sourcePlatformId: state.lastSourcePlatformId,
    trackId: track.id,
    commandPoint: {
      x: track.position.x + track.velocity.x * 1.5,
      y: track.position.y + track.velocity.y * 1.5,
      z: track.position.z + track.velocity.z * 1.5,
    },
  };
}
