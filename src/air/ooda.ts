import type { AirMissionOrder, AirThrustMode, AirTrack } from "./types";
import type { DefenseObservation } from "../defense/targeting.js";
import { selectConsumerTarget } from "../defense/consumer.js";
import type {
  EngagementRecord,
  EngagementSourceId,
} from "../defense/engagement";

export function airTrackObservation(track: AirTrack): DefenseObservation {
  return {
    id: track.targetId,
    kind: track.classification,
    position: track.position,
    velocity: track.velocity,
    quality: track.quality,
    updatedAt: track.lastUpdate,
  };
}

export function trackSupportsWeaponAuthorization(track: AirTrack | undefined) {
  return !!track && track.engagementQuality !== "cue" &&
    track.source !== "link11" && track.source !== "link16";
}

export function selectMissionTrack(input: {
  mission: AirMissionOrder;
  tracks: readonly AirTrack[];
  origin: { x: number; y: number; z: number };
  engagements?: ReadonlyMap<EngagementSourceId, EngagementRecord>;
  time?: number;
  reassessDelay?: number;
}) {
  const desiredClassification =
    input.mission === "anti-ship" ? "ship" : "aircraft";
  const observations = input.tracks.map(airTrackObservation);
  const policy = {
    acceptedKinds: [desiredClassification],
    distanceWeight: 1,
  } as const;
  const selected = selectConsumerTarget({
    origin: input.origin,
    observations,
    policy,
    engagements: input.engagements ?? new Map(),
    acceptEngagement: (_observation, engagement) =>
      !engagement ||
      (engagement.pending === 0 &&
        (input.time ?? Infinity) - engagement.lastResolution >=
          (input.reassessDelay ?? 2)),
  });
  return selected
    ? input.tracks.find((track) => track.targetId === selected.id)
    : undefined;
}

export function missionShouldReturn(input: {
  mission: AirMissionOrder;
  hasEngaged: boolean;
  observedHostileAircraft: number;
  observedThreats: number;
  contactLostSeconds: number;
  hasAirborneWeapon: boolean;
}) {
  return (
    (input.mission === "cap" || input.mission === "intercept") &&
    input.hasEngaged &&
    input.observedHostileAircraft === 0 &&
    input.observedThreats === 0 &&
    input.contactLostSeconds >= 20 &&
    !input.hasAirborneWeapon
  );
}

export function noContactMissionDirection(input: {
  mission: AirMissionOrder;
  side: "blue" | "red";
  currentHeading: { x: number; y: number; z: number };
}) {
  if (input.mission === "anti-ship") return { ...input.currentHeading };
  return {
    x: input.side === "blue" ? 0.25 : -0.25,
    y: 0,
    z: input.side === "blue" ? -1 : 1,
  };
}

export function defensiveManeuverFromWarning(input: {
  aircraftPosition: { x: number; y: number; z: number };
  warningPosition: { x: number; y: number; z: number };
  warningVelocity: { x: number; y: number; z: number };
  side: -1 | 1;
}) {
  const range = Math.hypot(
    input.warningPosition.x - input.aircraftPosition.x,
    input.warningPosition.y - input.aircraftPosition.y,
    input.warningPosition.z - input.aircraftPosition.z,
  );
  const speed = Math.max(
    1,
    Math.hypot(
      input.warningVelocity.x,
      input.warningVelocity.y,
      input.warningVelocity.z,
    ),
  );
  const horizontal =
    Math.hypot(input.warningVelocity.x, input.warningVelocity.z) || 1;
  return {
    range,
    timeToImpact: range / speed,
    direction: {
      x: (-input.warningVelocity.z / horizontal) * input.side,
      y: 0,
      z: (input.warningVelocity.x / horizontal) * input.side,
    },
  };
}

export function selectThrustMode(input: {
  mission: AirMissionOrder;
  state: "formation" | "engaging" | "defending" | "egress" | "disabled" | "crashed";
  fuelRatio: number;
  afterburnerAvailable: boolean;
  afterburnerRemaining: number;
  missileTti: number | null;
  targetRange: number | null;
  weaponMaxRange: number;
  speedRatio: number;
  desiredSpeedRatio?: number | null;
  formationRejoinError?: number | null;
  climbDemand: number;
}): AirThrustMode {
  if (input.state === "disabled" || input.state === "crashed") return "idle";
  const canUseAfterburner = input.afterburnerAvailable && input.afterburnerRemaining > 0;
  const imminentThreat = input.missileTti !== null && input.missileTti < 18;
  if (imminentThreat) return canUseAfterburner ? "afterburner" : "military";
  if (input.mission === "return") return "cruise";
  if (input.mission === "egress" || input.state === "egress")
    return input.fuelRatio > 0.18 && canUseAfterburner ? "afterburner" : "military";
  const outsideLaunchEnvelope = input.targetRange !== null &&
    input.weaponMaxRange > 0 && input.targetRange > input.weaponMaxRange * 0.82;
  const commandedSpeedDeficit = input.desiredSpeedRatio !== null &&
    input.desiredSpeedRatio !== undefined &&
    input.speedRatio < input.desiredSpeedRatio * .92;
  const commandedSpeedSatisfied = input.desiredSpeedRatio !== null &&
    input.desiredSpeedRatio !== undefined &&
    input.speedRatio >= input.desiredSpeedRatio * 1.04;
  const energyDeficit = input.speedRatio < 0.68 || input.climbDemand > 0.18 || commandedSpeedDeficit;
  const rejoinDemand = input.formationRejoinError !== null &&
    input.formationRejoinError !== undefined && input.formationRejoinError > 8;
  if (input.state === "formation" && rejoinDemand) {
    if (canUseAfterburner && input.fuelRatio > 0.35 &&
        input.formationRejoinError! > 90)
      return "afterburner";
    return "military";
  }
  if (input.state === "engaging" && (outsideLaunchEnvelope || energyDeficit)) {
    if (canUseAfterburner && input.fuelRatio > 0.28) return "afterburner";
    return "military";
  }
  if (input.state === "engaging" && commandedSpeedSatisfied && input.climbDemand < .12)
    return "cruise";
  if (input.state === "engaging" || input.state === "defending") return "military";
  return "cruise";
}

export function defensiveShotAllowed(input: {
  missileTti: number;
  trackQuality: number;
  organicWeaponAuthorization: boolean;
  missionCommandAllowsRelease: boolean;
  fireAndForget: boolean;
}) {
  return input.missileTti > (input.fireAndForget ? 3 : 8) &&
    input.trackQuality >= .22 &&
    input.organicWeaponAuthorization &&
    input.missionCommandAllowsRelease;
}
