import type { NavalForceRuntime } from "../fleet/types";
import type { TacticalRadarFrame, TacticalRadarSource } from "./tactical-radar";

function radarSource(source: string): TacticalRadarSource {
  if (source === "local-radar") return "organic";
  if (source === "esm") return "esm" as TacticalRadarSource;
  if (source === "passive-fusion") return "passive-fusion" as TacticalRadarSource;
  return source as TacticalRadarSource;
}
export function tacticalRadarFrameForShip(
  force: NavalForceRuntime,
  ownerId: string,
  time: number,
  scanBearingRad?: number,
): TacticalRadarFrame | undefined {
  const owner = force.ships.get(ownerId);
  if (!owner?.alive) return undefined;
  const comms = force.shipComms.get(owner.id);
  return {
    time,
    ownerId: owner.id,
    ownerLabel: owner.definition.name,
    sensorLabel: owner.definition.subsystemLabels.primaryRadar,
    ownerX: owner.position.x,
    ownerZ: owner.position.z,
    ownerHeadingRad: owner.heading,
    networkState: comms?.connected === false
      ? "LOST COMMS / LOCAL ONLY"
      : `${force.datalinkEra.toUpperCase()} ONLINE`,
    scanBearingRad,
    tracks: [...owner.localTracks.values(), ...owner.networkTracks.values()].map((track) => ({
      id: track.targetId,
      x: track.position.x,
      z: track.position.z,
      vx: track.velocity.x,
      vz: track.velocity.z,
      quality: track.quality,
      uncertaintyWorld: track.uncertainty,
      classification: track.classification,
      source: radarSource(track.source),
      updatedAt: track.updatedAt,
      weaponQuality: track.weaponQuality,
    })),
    friendlies: [...force.ships.values()]
      .filter((ship) => ship.alive && ship.id !== owner.id)
      .map((ship) => ({
        id: ship.id,
        x: ship.position.x,
        z: ship.position.z,
        headingRad: ship.heading,
      })),
  };
}

