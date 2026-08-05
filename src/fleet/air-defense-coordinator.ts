import type { ShipWeapon } from "../ship-types.js";
import { WEAPON_PROFILES } from "../interceptor-data.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "../ships/types.js";
import type { ForceEngagementAssignment, NavalForceRuntime } from "./types.js";
import {
  forceEngagementSuppressesAssignment,
  registerForceAssignment,
  resetForceEngagements,
} from "./engagement-runtime.js";

const ASSIGNMENT_LIFETIME_SECONDS = 7;

function distanceToFleet(force: NavalForceRuntime, track: ShipTrackEstimate) {
  return Math.min(...[...force.ships.values()]
    .filter((ship) => ship.alive)
    .map((ship) => ship.position.distanceTo(track.position)));
}

export function assessFleetAirThreat(force: NavalForceRuntime, track: ShipTrackEstimate, now: number) {
  const range = distanceToFleet(force, track);
  const speed = Math.max(0.25, track.velocity.length());
  const timeToImpact = range / speed;
  const age = Math.max(0, now - track.updatedAt);
  const classification = track.classification === "missile" ? 125
    : track.classification === "aircraft" ? 45 : 10;
  const urgency = Math.max(0, 150 - timeToImpact) * 1.6;
  const score = classification + urgency + track.quality * 35
    - Math.min(55, age * 8) - Math.min(35, track.uncertainty / 180);
  return { score, timeToImpact, range };
}

function associateLocalTrack(forceTrack: ShipTrackEstimate, ship: ShipCombatantInstance) {
  const exact = ship.localTracks.get(forceTrack.targetId);
  if (exact?.weaponQuality && exact.classification === forceTrack.classification) return exact;
  return [...ship.localTracks.values()]
    .filter((track) => track.weaponQuality && track.classification === forceTrack.classification)
    .map((track) => ({
      track,
      separation: track.position.distanceTo(forceTrack.position),
      gate: Math.max(18, (track.uncertainty + forceTrack.uncertainty) / 100),
    }))
    .filter(({ separation, gate }) => separation <= gate)
    .sort((a, b) => a.separation - b.separation)[0]?.track;
}

function availableChannels(ship: ShipCombatantInstance) {
  const pending = [...ship.engagements.values()].reduce((total, record) => total + record.pending, 0);
  return {
    launch: Math.max(0, ship.launcherChannels - pending),
    illuminate: Math.max(0, ship.illuminatorChannels - pending),
  };
}

function selectWeapon(
  force: NavalForceRuntime,
  ship: ShipCombatantInstance,
  range: number,
  emergency: boolean,
) {
  const compatible = new Set(ship.definition.launcher.compatibleWeapons);
  const priority: readonly ShipWeapon[] = range > WEAPON_PROFILES["SM-2MR"].maxRange * 0.75
    ? ["SM-2ER", "RIM-67", "SM-2MR"] : ["SM-2MR", "RIM-67", "SM-2ER"];
  return priority.find((weapon) => {
    const profile = WEAPON_PROFILES[weapon];
    const rounds = ship.magazines.rounds.get(weapon) ?? 0;
    const initial = weapon === "RIM-67" ? ship.definition.ammo.rim67
      : weapon === "SM-2MR" ? ship.definition.ammo.sm2mr : ship.definition.ammo.sm2er;
    const reserve = emergency ? 0 : Math.ceil(initial * force.doctrine.reserveFraction);
    return compatible.has(weapon) && rounds > reserve
      && range >= profile.minRange && range <= profile.maxRange;
  });
}

function shooterUtility(
  force: NavalForceRuntime,
  ship: ShipCombatantInstance,
  forceTrack: ShipTrackEstimate,
  timeToImpact: number,
  plannedChannels: number,
) {
  if (!ship.alive || ship.hullIntegrity <= 0) return undefined;
  const fireControl = (ship.subsystemHealth.get("fireControl") ?? 0) / 100;
  const launcherHealth = Math.max(
    ship.subsystemHealth.get("forwardLauncher") ?? 0,
    ship.subsystemHealth.get("aftLauncher") ?? 0,
  ) / 100;
  const channels = availableChannels(ship);
  channels.launch = Math.max(0, channels.launch - plannedChannels);
  channels.illuminate = Math.max(0, channels.illuminate - plannedChannels);
  if (fireControl < 0.35 || launcherHealth < 0.25 || channels.launch < 1 || channels.illuminate < 1)
    return undefined;
  const localTrack = associateLocalTrack(forceTrack, ship);
  if (!localTrack) return undefined;
  const range = ship.position.distanceTo(localTrack.position);
  const weapon = selectWeapon(force, ship, range, timeToImpact < 38);
  if (!weapon) return undefined;
  const rounds = ship.magazines.rounds.get(weapon) ?? 0;
  const formationBonus = force.formationRoles.get(ship.id) === "picket" ? 24 : 0;
  // AAWC must distribute simultaneous shots across independent ships when
  // they have organic weapon-quality tracks. Otherwise the OTC wins every
  // utility comparison and the screen is only decorative.
  const allocationPenalty = plannedChannels * 42;
  const utility = localTrack.quality * 100 + fireControl * 35 + launcherHealth * 20
    + Math.min(30, rounds) + channels.launch * 5 + formationBonus
    - allocationPenalty - range * 0.025;
  return { ship, localTrack, weapon, utility };
}

export class FleetAirDefenseCoordinator {
  private nextAssignment = 1;

  update(force: NavalForceRuntime, now: number) {
    const aawcId = force.commandRoles.get("aawc");
    const aawc = aawcId ? force.ships.get(aawcId) : undefined;
    if (!aawc?.alive) return;
    const plannedChannels = new Map<string, number>();
    for (const assignment of force.assignments.values()) {
      if (assignment.status !== "assigned" && assignment.status !== "accepted") continue;
      plannedChannels.set(
        assignment.shooterId,
        (plannedChannels.get(assignment.shooterId) ?? 0) + assignment.requestedShots,
      );
    }
    const centralized = [...force.picture.entries()].map(([trackId, track]) => ({ trackId, track, autonomousShooterId:undefined as string|undefined }));
    const autonomous = [...force.ships.values()]
      .filter((ship) => force.shipComms.get(ship.id)?.connected === false)
      .flatMap((ship) => [...ship.localTracks.entries()].map(([trackId, track]) => ({trackId:`${ship.id}:organic:${trackId}`,track,autonomousShooterId:ship.id})));
    const threats = [...centralized, ...autonomous]
      .filter(({trackId, track}) => !forceEngagementSuppressesAssignment(force.engagements.get(trackId))
        && (track.classification === "missile" || track.classification === "aircraft"))
      .map(({trackId, track, autonomousShooterId}) => ({ trackId, track, autonomousShooterId, ...assessFleetAirThreat(force, track, now) }))
      .sort((a, b) => b.score - a.score);
    for (const threat of threats) {
      const shooter = [...force.ships.values()]
        .filter((ship) => threat.autonomousShooterId ? ship.id === threat.autonomousShooterId : force.shipComms.get(ship.id)?.connected !== false)
        .map((ship) => shooterUtility(
          force, ship, threat.track, threat.timeToImpact, plannedChannels.get(ship.id) ?? 0,
        ))
        .filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate)
        .sort((a, b) => b.utility - a.utility)[0];
      if (!shooter) continue;
      const requestedShots = threat.timeToImpact < 30 ? 3
        : threat.track.quality < 0.58 || threat.track.classification === "missile" ? 2 : 1;
      const id = `AAW-${String(this.nextAssignment++).padStart(4, "0")}`;
      const assignment: ForceEngagementAssignment = {
        id,
        forceTrackId: threat.trackId,
        shooterId: shooter.ship.id,
        localTrackId: shooter.localTrack.targetId,
        weapon: shooter.weapon,
        requestedShots,
        threatScore: threat.score,
        estimatedTimeToImpact: threat.timeToImpact,
        assignedAt: now,
        expiresAt: now + ASSIGNMENT_LIFETIME_SECONDS,
        status: "assigned",
        updatedAt: now,
      };
      registerForceAssignment(force, assignment);
      plannedChannels.set(
        shooter.ship.id,
        (plannedChannels.get(shooter.ship.id) ?? 0) + requestedShots,
      );
    }
  }

  reset(force: NavalForceRuntime) {
    resetForceEngagements(force);
    this.nextAssignment = 1;
  }
}
