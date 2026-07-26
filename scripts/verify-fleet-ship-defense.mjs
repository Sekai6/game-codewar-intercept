import * as THREE from "three";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { registerForceAssignment } from "../dist-test/fleet/engagement-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";
import {
  cancelShipLaunchOrder,
  executeShipDefenseAssignment,
} from "../dist-test/ships/weapon-runtime.js";

const definition = (id, kind) => ({
  id, name: id, hullNumber: id, era: "test", role: "test",
  platform: { maxSpeedKnots: 30, cruiseSpeedKnots: 18, patrolSpeedKnots: 10,
    accelerationKnotsPerSecond: 1, decelerationKnotsPerSecond: 1, turnRateDeg: 2,
    decisionInterval: 1, standoffRange: 1, standoffTolerance: 1,
    significantHeightMeters: 20, radarRcs: 10 },
  launcher: { kind, displayName: kind, compatibleWeapons: kind === "mk10" ? ["RIM-67"] : ["SM-2MR", "SM-2ER"],
    ...(kind === "mk10" ? { azimuthRateDeg: 20, elevationRateDeg: 10, reloadSeconds: 8 }
      : { columns: 8, sequenceInterval: .5, exhaustClearance: 1, isolationStartsAt: 1,
        maximumIsolationFraction: .2, loadingPermutation: 1, gridSize: 8 }) },
  sensors: [], ammo: { rim67: 8, sm2mr: 12, sm2er: 8, ciws: 1000, channels: 3, illuminators: 2 },
  subsystemLabels: {}, subsystemPositions: {}, damageModel: { longitudinalLimit: 1, zones: [] },
  build: () => new THREE.Group(),
});
const makeForce = () => createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"], new Map([
  ["long-beach", definition("long-beach", "mk10")],
  ["ticonderoga", definition("ticonderoga", "mk41")],
]));
const localTrack = (source = "local-radar", updatedAt = 1, range = 200) => ({
  targetId: "T-1", position: new THREE.Vector3(-180 + range, 12, -120), velocity: new THREE.Vector3(0, 0, 2),
  quality: .8, uncertainty: 100, classification: "missile", source, updatedAt, weaponQuality: source === "local-radar",
});
const setup = (mutate = () => {}) => {
  const force = makeForce(), ship = force.ships.get("blue-cg-57"), other = force.ships.get("blue-cgn-9");
  const track = localTrack(); ship.localTracks.set(track.targetId, track);
  const assignment = { id: "AAW-X", forceTrackId: "T-1", shooterId: ship.id, localTrackId: track.targetId,
    weapon: "SM-2MR", requestedShots: 2, threatScore: 100, estimatedTimeToImpact: 30,
    assignedAt: 1, expiresAt: 8, status: "assigned", updatedAt: 1 };
  registerForceAssignment(force, assignment); mutate({ force, ship, other, track, assignment });
  return { force, ship, other, track, assignment };
};
const run = (state, reserve = () => ({ accepted: true })) => executeShipDefenseAssignment({
  force: state.force, ship: state.ship, now: 2, reserveLauncher: reserve, targetAvailable: () => true,
}, state.assignment);

const network = setup(({ ship }) => { ship.localTracks.set("T-1", localTrack("link11")); });
const networkOnlyBlocked = !run(network).accepted && network.assignment.rejectionReason === "LOCAL TRACK NOT WEAPON QUALITY";
const wrong = setup(({ assignment }) => { assignment.shooterId = "blue-cgn-9"; });
const wrongShooterBlocked = !run(wrong).accepted && wrong.assignment.status === "assigned";
const stale = setup(({ ship }) => { ship.localTracks.set("T-1", localTrack("local-radar", -2)); });
const staleBlocked = !run(stale).accepted && stale.assignment.rejectionReason === "LOCAL TRACK STALE";
const range = setup(({ ship }) => { ship.localTracks.set("T-1", localTrack("local-radar", 1, 900)); });
const rangeBlocked = !run(range).accepted && range.assignment.rejectionReason === "OUT OF ENVELOPE";
const empty = setup(({ ship }) => ship.magazines.rounds.set("SM-2MR", 0));
const emptyBlocked = !run(empty).accepted && empty.assignment.rejectionReason === "MAGAZINE EMPTY";
const launcher = setup();
const launcherBlocked = !run(launcher, () => ({ accepted: false })).accepted
  && launcher.assignment.rejectionReason === "LAUNCHER UNAVAILABLE";
const fireControl = setup(({ ship }) => ship.subsystemHealth.set("fireControl", 20));
const fireControlBlocked = !run(fireControl).accepted;
const noIlluminator = setup(({ ship }) => { ship.illuminatorChannels = 0; });
const illuminatorBlocked = !run(noIlluminator).accepted;

const valid = setup(), otherAmmo = valid.other.magazines.rounds.get("RIM-67"), before = valid.ship.magazines.rounds.get("SM-2MR");
let reservations = 0, departures = 0;
const accepted = run(valid, () => { reservations++; return { accepted: true }; });
const exactOwnedReservations = accepted.accepted && reservations === 2
  && valid.ship.magazines.rounds.get("SM-2MR") === before - 2
  && valid.ship.engagements.get("T-1")?.pending === 2;
const queueIsNotDeparture = departures === 0 && valid.assignment.status === "accepted"
  && valid.force.engagements.get("T-1")?.weaponsCommitted === 0;
cancelShipLaunchOrder(valid.ship, accepted.orders[0], 2.5);
const cancellationReturnsOwnedRound = valid.ship.magazines.rounds.get("SM-2MR") === before - 1
  && valid.ship.engagements.get("T-1")?.pending === 1;
const otherShipUntouched = valid.other.magazines.rounds.get("RIM-67") === otherAmmo
  && valid.other.engagements.size === 0;

const result = { networkOnlyBlocked, wrongShooterBlocked, staleBlocked, rangeBlocked, emptyBlocked,
  launcherBlocked, fireControlBlocked, illuminatorBlocked, exactOwnedReservations,
  queueIsNotDeparture, cancellationReturnsOwnedRound, otherShipUntouched };
console.log(JSON.stringify(result, null, 2));
if (Object.values(result).some((value) => value !== true)) process.exitCode = 1;
