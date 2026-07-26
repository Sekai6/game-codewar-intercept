import { recordEngagement, resolveEngagement } from "../defense/engagement.js";
import { WEAPON_PROFILES } from "../interceptor-data.js";
import type { ShipWeapon } from "../ship-types.js";
import {
  acceptForceAssignment,
  rejectForceAssignment,
} from "../fleet/engagement-runtime.js";
import type {
  ForceEngagementAssignment,
  NavalForceRuntime,
} from "../fleet/types.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "./types.js";

export type ShipLaunchRejection =
  | "WRONG SHOOTER"
  | "ASSIGNMENT NOT ACTIVE"
  | "LOCAL TRACK LOST"
  | "LOCAL TRACK NOT WEAPON QUALITY"
  | "LOCAL TRACK STALE"
  | "OUT OF ENVELOPE"
  | "MAGAZINE EMPTY"
  | "FIRE CONTROL UNAVAILABLE"
  | "LAUNCH CHANNEL UNAVAILABLE"
  | "ILLUMINATOR UNAVAILABLE"
  | "LAUNCHER UNAVAILABLE"
  | "TARGET UNAVAILABLE";

export interface ShipLaunchOrder {
  assignmentId: string;
  shooterId: string;
  localTrackId: string;
  weapon: ShipWeapon;
  shotIndex: number;
  track: ShipTrackEstimate;
}

export interface ShipLaunchReservation {
  accepted: boolean;
  cancel?: () => void;
}

export interface ShipDefenseExecutorDependencies {
  force: NavalForceRuntime;
  ship: ShipCombatantInstance;
  now: number;
  reserveLauncher: (order: ShipLaunchOrder) => ShipLaunchReservation;
  targetAvailable: (targetId: string) => boolean;
}

function pendingCount(ship: ShipCombatantInstance) {
  return [...ship.engagements.values()].reduce((sum, record) => sum + record.pending, 0);
}

function validate(
  deps: ShipDefenseExecutorDependencies,
  assignment: ForceEngagementAssignment,
): ShipLaunchRejection | ShipTrackEstimate {
  const { ship, now } = deps;
  if (assignment.shooterId !== ship.id) return "WRONG SHOOTER";
  if (assignment.status !== "assigned" || now >= assignment.expiresAt)
    return "ASSIGNMENT NOT ACTIVE";
  const track = ship.localTracks.get(assignment.localTrackId);
  if (!track) return "LOCAL TRACK LOST";
  if (!track.weaponQuality || track.source !== "local-radar")
    return "LOCAL TRACK NOT WEAPON QUALITY";
  if (now - track.updatedAt > 2.2) return "LOCAL TRACK STALE";
  const profile = WEAPON_PROFILES[assignment.weapon];
  const range = ship.position.distanceTo(track.position);
  if (range < profile.minRange || range > profile.maxRange) return "OUT OF ENVELOPE";
  if ((ship.magazines.rounds.get(assignment.weapon) ?? 0) < 1) return "MAGAZINE EMPTY";
  if ((ship.subsystemHealth.get("fireControl") ?? 0) < 35) return "FIRE CONTROL UNAVAILABLE";
  const pending = pendingCount(ship);
  if (pending >= ship.launcherChannels) return "LAUNCH CHANNEL UNAVAILABLE";
  if (pending >= ship.illuminatorChannels) return "ILLUMINATOR UNAVAILABLE";
  if (!deps.targetAvailable(assignment.localTrackId)) return "TARGET UNAVAILABLE";
  return track;
}

export function executeShipDefenseAssignment(
  deps: ShipDefenseExecutorDependencies,
  assignment: ForceEngagementAssignment,
) {
  const checked = validate(deps, assignment);
  if (typeof checked === "string") {
    if (checked !== "WRONG SHOOTER" && checked !== "ASSIGNMENT NOT ACTIVE")
      rejectForceAssignment(deps.force, assignment.id, deps.ship.id, checked, deps.now);
    return { accepted: false, reason: checked, orders: [] as ShipLaunchOrder[] };
  }
  const availableRounds = deps.ship.magazines.rounds.get(assignment.weapon) ?? 0;
  const freeChannels = Math.max(0, Math.min(
    deps.ship.launcherChannels,
    deps.ship.illuminatorChannels,
  ) - pendingCount(deps.ship));
  const count = Math.min(assignment.requestedShots, availableRounds, freeChannels);
  const orders: ShipLaunchOrder[] = [];
  const reservations: ShipLaunchReservation[] = [];
  for (let shotIndex = 0; shotIndex < count; shotIndex++) {
    const order: ShipLaunchOrder = {
      assignmentId: assignment.id,
      shooterId: deps.ship.id,
      localTrackId: assignment.localTrackId,
      weapon: assignment.weapon,
      shotIndex,
      track: checked,
    };
    const reservation = deps.reserveLauncher(order);
    if (!reservation.accepted) break;
    deps.ship.magazines.rounds.set(
      assignment.weapon,
      (deps.ship.magazines.rounds.get(assignment.weapon) ?? 0) - 1,
    );
    recordEngagement(deps.ship.engagements, assignment.localTrackId);
    orders.push(order);
    reservations.push(reservation);
  }
  if (!orders.length) {
    rejectForceAssignment(deps.force, assignment.id, deps.ship.id, "LAUNCHER UNAVAILABLE", deps.now);
    return { accepted: false, reason: "LAUNCHER UNAVAILABLE" as const, orders };
  }
  if (!acceptForceAssignment(deps.force, assignment.id, deps.ship.id, deps.now)) {
    reservations.forEach((reservation) => reservation.cancel?.());
    deps.ship.magazines.rounds.set(assignment.weapon, availableRounds);
    for (const order of orders)
      resolveEngagement(deps.ship.engagements, order.localTrackId, "cancel", deps.now);
    return { accepted: false, reason: "ASSIGNMENT NOT ACTIVE" as const, orders: [] };
  }
  return { accepted: true, orders };
}

export function cancelShipLaunchOrder(
  ship: ShipCombatantInstance,
  order: ShipLaunchOrder,
  now: number,
) {
  ship.magazines.rounds.set(order.weapon, (ship.magazines.rounds.get(order.weapon) ?? 0) + 1);
  resolveEngagement(ship.engagements, order.localTrackId, "cancel", now);
}
