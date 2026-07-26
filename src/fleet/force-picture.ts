import * as THREE from "three";
import type { ShipTrackEstimate } from "../ships/types.js";
import type { NavalForceRuntime } from "./types.js";

function associationDistance(a: ShipTrackEstimate, b: ShipTrackEstimate) {
  return Math.max(15, (a.uncertainty + b.uncertainty) / 100);
}

export function buildForcePicture(force: NavalForceRuntime, now: number) {
  const candidates = [...force.ships.values()].flatMap((ship) => [
    ...[...ship.localTracks.values()].map((track) => ({ track, contributor: `${ship.id}:organic-radar` })),
    ...[...ship.networkTracks.values()].map((track) => ({ track, contributor: `${ship.id}:${track.source}` })),
  ]).filter(({ track }) => now - track.updatedAt <= (track.source === "link11" ? 24 : 8));
  const fused = new Map<string, ShipTrackEstimate>();
  for (const { track: candidate, contributor } of candidates.sort((a, b) => b.track.quality - a.track.quality)) {
    const associated = [...fused.entries()].find(([, current]) =>
      current.classification === candidate.classification
      && current.position.distanceTo(candidate.position) <= associationDistance(current, candidate));
    if (!associated) {
      fused.set(candidate.targetId, {
        ...candidate,
        position: candidate.position.clone(),
        velocity: candidate.velocity.clone(),
        weaponQuality: false,
        contributors: [contributor],
      });
      continue;
    }
    const [key, current] = associated;
    const total = Math.max(0.01, current.quality + candidate.quality);
    const candidateWeight = candidate.quality / total;
    current.position.lerp(candidate.position, candidateWeight);
    current.velocity.lerp(candidate.velocity, candidateWeight);
    current.quality = THREE.MathUtils.clamp(
      Math.max(current.quality, candidate.quality) + Math.min(current.quality, candidate.quality) * 0.12,
      0,
      0.92,
    );
    current.uncertainty = Math.min(current.uncertainty, candidate.uncertainty) * 0.92;
    current.updatedAt = Math.max(current.updatedAt, candidate.updatedAt);
    current.weaponQuality = false;
    if (!current.contributors?.includes(contributor))
      current.contributors = [...(current.contributors ?? []), contributor];
    fused.set(key, current);
  }
  force.picture = fused;
  return fused;
}
