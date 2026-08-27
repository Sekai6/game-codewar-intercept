import type { CecCompositeTrack } from "./types.js";

/** Stable, serialisable view used by HUD/AAR/Tacview adapters. */
export interface CecTrackObservation {
  id: string;
  targetId: string;
  contributors: readonly string[];
  quality: number;
  age: number;
  engagementQuality: CecCompositeTrack["engagementQuality"];
  weaponSupport: boolean;
  covariancePosition: number;
  covarianceVelocity: number;
}

export interface CecObservation {
  state: "off" | "standby" | "active" | "degraded" | string;
  participantIds: readonly string[];
  measurements: number;
  tracks: readonly CecTrackObservation[];
  lastEvent?: string;
}

export function cecTrackObservation(track: CecCompositeTrack, now: number): CecTrackObservation {
  return {
    id: track.id,
    targetId: track.targetId,
    contributors: [...track.contributors],
    quality: track.quality,
    age: Math.max(0, now - track.lastMeasurementAt),
    engagementQuality: track.engagementQuality,
    weaponSupport: track.weaponSupport.allowed,
    covariancePosition: track.covariance.positionVariance,
    covarianceVelocity: track.covariance.velocityVariance,
  };
}

export function cecTacviewProperties(observation: CecObservation): Record<string, string | number> {
  const weaponTracks = observation.tracks.filter((track) => track.weaponSupport).length;
  return {
    CECState: observation.state.toUpperCase(),
    CECParticipants: observation.participantIds.join("|"),
    CECMeasurements: observation.measurements,
    CECCompositeTracks: observation.tracks.length,
    CECWeaponTracks: weaponTracks,
    CECTrackIds: observation.tracks.map((track) => track.id).join("|"),
    CECTrackContributors: observation.tracks.map((track) => `${track.id}:${track.contributors.join("+")}`).join("|"),
    CECMeasurementAge: observation.tracks.map((track) => `${track.id}:${track.age.toFixed(2)}`).join("|"),
    CECCovariance: observation.tracks.map((track) => `${track.id}:P${track.covariancePosition.toFixed(2)},V${track.covarianceVelocity.toFixed(2)}`).join("|"),
    CECWeaponSupport: observation.tracks.map((track) => `${track.id}:${track.weaponSupport ? "YES" : "NO"}`).join("|"),
  };
}

export function cecMeasurementSummary(measurement: { id: string; sourcePlatformId: string; sourceSensorId: string; targetId: string; quality: number; timeSyncQuality: number }): string {
  return `${measurement.id} ${measurement.sourcePlatformId}/${measurement.sourceSensorId} -> ${measurement.targetId} Q=${measurement.quality.toFixed(3)} SYNC=${measurement.timeSyncQuality.toFixed(3)}`;
}
