import type { ShipTrackEstimate } from "../ships/types.js";
import type { NavalForceRuntime } from "./types.js";
import { ConflictTrackFusionRuntime } from "../tracks/conflict-fusion.js";

function associationDistance(a: ShipTrackEstimate, b: ShipTrackEstimate) {
  return Math.max(15, (a.uncertainty + b.uncertainty) / 100);
}

export function buildForcePicture(force: NavalForceRuntime, now: number, fusion = new ConflictTrackFusionRuntime()) {
  const candidates = [...force.ships.values()].filter((ship) => force.shipComms.get(ship.id)?.connected !== false).flatMap((ship) => [
    ...[...ship.localTracks.values()].map((track) => ({ track, contributor: `${ship.id}:organic-radar` })),
    ...[...ship.networkTracks.values()].map((track) => ({ track, contributor: `${ship.id}:${track.source}` })),
  ]).filter(({ track }) => now - track.updatedAt <= (track.source === "link11" ? 24 : 8));
  const fused = fusion.fuse(candidates,now);
  force.picture = fused;
  return fused;
}
