import type { ShipCombatantInstance, ShipTrackEstimate } from "../ships/types.js";
import type { NavalForceRuntime, SurfaceStrikeAssignment } from "./types.js";

const ASSIGNMENT_LIFE = 18;

function localSurfaceTrack(ship: ShipCombatantInstance, forceTrack: ShipTrackEstimate) {
  const exact = ship.localTracks.get(forceTrack.targetId);
  if (exact && exact.classification === "ship" && exact.weaponQuality) return exact;
  return [...ship.localTracks.values()]
    .filter((track) => track.classification === "ship" && track.weaponQuality)
    .map((track) => ({ track, distance: track.position.distanceTo(forceTrack.position) }))
    .filter(({ distance }) => distance <= Math.max(16, forceTrack.uncertainty / 60))
    .sort((a, b) => a.distance - b.distance)[0]?.track;
}

function eligibleShooter(force: NavalForceRuntime, ship: ShipCombatantInstance, track: ShipTrackEstimate) {
  const strike = ship.definition.surfaceStrike;
  if (!ship.alive || !strike || ship.magazines.surfaceStrike <= 0) return undefined;
  const radar = (ship.subsystemHealth.get("primaryRadar") ?? 0) / 100;
  const fireControl = (ship.subsystemHealth.get("fireControl") ?? 0) / 100;
  const local = localSurfaceTrack(ship, track);
  if (!local || radar < 0.18 || fireControl < 0.25) return undefined;
  const range = ship.position.distanceTo(local.position);
  if (range < strike.minRange || range > strike.maxRange || local.quality < strike.requiredTrackQuality) return undefined;
  const roleBonus = force.formationRoles.get(ship.id) === "picket" ? 0.18 : 0;
  return { ship, local, score: local.quality + radar * 0.2 + fireControl * 0.15 + roleBonus - range / strike.maxRange * 0.12 };
}

export class FleetSurfaceWarfareCoordinator {
  private serial = 0;

  update(force: NavalForceRuntime, now: number) {
    for (const [id, assignment] of force.surfaceAssignments) {
      if (assignment.status !== "assigned" || now - assignment.assignedAt <= ASSIGNMENT_LIFE) continue;
      assignment.status = "expired";
      assignment.rejectionReason = "ASSIGNMENT_TIMEOUT";
      force.surfaceAssignments.delete(id);
    }
    const asuwc = force.commandRoles.get("asuwc");
    const candidates = [...force.picture.entries()]
      .filter(([, track]) => track.classification === "ship")
      .map(([targetId, track]) => ({ targetId, track }))
      .filter(({ targetId }) => ![...force.surfaceAssignments.values()].some((assignment) => assignment.targetId === targetId && assignment.status === "assigned"));
    for (const candidate of candidates) {
      const shooters = [...force.ships.values()]
        .map((ship) => eligibleShooter(force, ship, candidate.track))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.score - a.score);
      const preferred = asuwc ? shooters.find((item) => item.ship.id === asuwc) : undefined;
      const selected = preferred ?? shooters[0];
      if (!selected) continue;
      const strike = selected.ship.definition.surfaceStrike!;
      const requestedWeapons = Math.min(
        selected.ship.magazines.surfaceStrike,
        Math.max(strike.minimumSalvoSize, Math.min(strike.salvoSize, Math.ceil(strike.targetHullEstimate / Math.max(1, strike.damage)))),
      );
      const assignment: SurfaceStrikeAssignment = {
        id: `ASUW-${String(++this.serial).padStart(4, "0")}`,
        targetId: candidate.targetId,
        shooterId: selected.ship.id,
        localTrackId: selected.local.targetId,
        requestedWeapons,
        quality: selected.local.quality,
        assignedAt: now,
        status: "assigned",
      };
      force.surfaceAssignments.set(assignment.id, assignment);
    }
  }

  reset(force: NavalForceRuntime) {
    force.surfaceAssignments.clear();
    this.serial = 0;
  }
}
