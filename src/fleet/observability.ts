import type { TacticalNetworkActivity } from "../datalink/types.js";
import type { NavalForceRuntime } from "./types.js";

export interface FleetMemberObservation {
  id: string;
  name: string;
  hullNumber: string;
  side: "blue" | "red";
  x: number;
  y: number;
  z: number;
  heading: number;
  speedKnots: number;
  hull: number;
  alive: boolean;
  formationRole: string;
  commandRoles: string[];
  stationStatus: string;
  stationError: number;
  magazines: { rim67: number; sm2mr: number; sm2er: number };
  localTracks: number;
  networkTracks: number;
}

export interface FleetTrackObservation {
  id: string;
  x: number;
  y: number;
  z: number;
  classification: string;
  quality: number;
  uncertainty: number;
  age: number;
  contributors: string[];
  weaponAuthority: false;
}

export interface FleetObservation {
  id: string;
  enabled: true;
  datalinkEra: string;
  link11Enabled: boolean;
  formation: string;
  members: FleetMemberObservation[];
  tracks: FleetTrackObservation[];
  assignments: Array<{
    id: string;
    targetId: string;
    shooterId: string;
    localTrackId: string;
    weapon: string;
    requestedShots: number;
    weaponsAway: number;
    status: string;
    rejectionReason?: string;
    updatedAt: number;
  }>;
  engagements: Array<{
    targetId: string;
    shooters: string[];
    weaponsCommitted: number;
    estimatedPk: number;
    status: string;
    updatedAt: number;
  }>;
  networkActivities: readonly TacticalNetworkActivity[];
}

export function observeFleet(
  force: NavalForceRuntime,
  now: number,
  link11Enabled: boolean,
  networkActivities: readonly TacticalNetworkActivity[],
): FleetObservation {
  return {
    id: force.id,
    enabled: true,
    datalinkEra: force.datalinkEra,
    link11Enabled,
    formation: force.formation,
    members: [...force.ships.values()].map((ship) => {
      const station = force.formationState.stations.get(ship.id);
      return {
        id: ship.id,
        name: ship.definition.name,
        hullNumber: ship.definition.hullNumber,
        side: ship.side,
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
        heading: ship.heading,
        speedKnots: ship.speedKnots,
        hull: ship.hullIntegrity,
        alive: ship.alive,
        formationRole: force.formationRoles.get(ship.id) ?? "escort",
        commandRoles: [...force.commandRoles]
          .filter(([, owner]) => owner === ship.id)
          .map(([role]) => role),
        stationStatus: station?.status ?? "unknown",
        stationError: station?.errorDistance ?? 0,
        magazines: {
          rim67: ship.magazines.rounds.get("RIM-67") ?? 0,
          sm2mr: ship.magazines.rounds.get("SM-2MR") ?? 0,
          sm2er: ship.magazines.rounds.get("SM-2ER") ?? 0,
        },
        localTracks: ship.localTracks.size,
        networkTracks: ship.networkTracks.size,
      };
    }),
    tracks: [...force.picture.entries()].map(([id, track]) => ({
      id,
      x: track.position.x,
      y: track.position.y,
      z: track.position.z,
      classification: track.classification,
      quality: track.quality,
      uncertainty: track.uncertainty,
      age: Math.max(0, now - track.updatedAt),
      contributors: [...(track.contributors ?? [])],
      weaponAuthority: false,
    })),
    assignments: [...force.assignments.values()].map((assignment) => ({
      id: assignment.id,
      targetId: assignment.forceTrackId,
      shooterId: assignment.shooterId,
      localTrackId: assignment.localTrackId,
      weapon: assignment.weapon,
      requestedShots: assignment.requestedShots,
      weaponsAway: assignment.weaponsAwayCount ?? 0,
      status: assignment.status,
      rejectionReason: assignment.rejectionReason,
      updatedAt: assignment.updatedAt,
    })),
    engagements: [...force.engagements.values()].map((record) => ({
      targetId: record.targetId,
      shooters: [...record.assignedShooters],
      weaponsCommitted: record.weaponsCommitted,
      estimatedPk: record.estimatedPk,
      status: record.status,
      updatedAt: record.lastUpdatedAt,
    })),
    networkActivities,
  };
}
