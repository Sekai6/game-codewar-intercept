import type { AirMissionOrder } from "../types.js";

export type MissionPhase =
  | "on-station"
  | "commit"
  | "retreat"
  | "abort"
  | "egress"
  | "return";

export interface MissionPlannerState {
  assignedMission: AirMissionOrder;
  phase: MissionPhase;
  enteredAt: number;
  reason: string;
  home: readonly [number, number, number];
  station: readonly [number, number, number];
  retreatUntil: number;
  updates: number;
}

export interface MissionContactEstimate {
  position: { x: number; y: number; z: number };
  quality: number;
  classification: "unknown" | "aircraft" | "ship";
}

export interface MissionPlan {
  state: MissionPlannerState;
  order: AirMissionOrder;
  navigationPoint: readonly [number, number, number] | null;
}

const distance = (
  left: { x: number; y: number; z: number },
  right: readonly [number, number, number],
) => Math.hypot(left.x - right[0], left.y - right[1], left.z - right[2]);

export function initialMissionPlannerState(input: {
  mission: AirMissionOrder;
  position: { x: number; y: number; z: number };
}): MissionPlannerState {
  const point = [input.position.x, input.position.y, input.position.z] as const;
  return {
    assignedMission: input.mission,
    phase: "on-station",
    enteredAt: 0,
    reason: "assigned",
    home: point,
    station: point,
    retreatUntil: 0,
    updates: 0,
  };
}

function transition(
  state: MissionPlannerState,
  phase: MissionPhase,
  time: number,
  reason: string,
  changes: Partial<MissionPlannerState> = {},
): MissionPlannerState {
  return {
    ...state,
    ...changes,
    phase,
    enteredAt: state.phase === phase ? state.enteredAt : time,
    reason,
    updates: state.updates + 1,
  };
}

export function planAirMission(input: {
  time: number;
  state: MissionPlannerState;
  currentOrder: AirMissionOrder;
  position: { x: number; y: number; z: number };
  heading: { x: number; y: number; z: number };
  fuelRemaining: number;
  nominalFuel: number;
  cruiseSpeed: number;
  engineHealth: number;
  flightControlHealth: number;
  radarHealth: number;
  weaponSystemHealth: number;
  weaponsRemaining: number;
  hasAirborneWeapon: boolean;
  hasEngaged: boolean;
  contactLostSeconds: number;
  contacts: readonly MissionContactEstimate[];
  protectedAssetAlive: boolean;
  escortAvailable: boolean;
}): MissionPlan {
  const state = input.state;
  if (input.currentOrder === "return" || state.phase === "return") {
    const next = transition(state, "return", input.time,
      state.reason === "assigned" ? "external-return" : state.reason);
    return { state: next, order: "return", navigationPoint: next.home };
  }
  if (input.currentOrder === "egress" || state.phase === "egress") {
    const next = transition(state, "egress", input.time,
      state.reason === "assigned" ? "external-egress" : state.reason);
    return { state: next, order: "egress", navigationPoint: next.home };
  }
  const homeTransitSeconds = distance(input.position, state.home) /
    Math.max(0.1, input.cruiseSpeed);
  const reserveSeconds = input.nominalFuel * 0.12 + homeTransitSeconds * 1.2;
  const fuelCritical = input.fuelRemaining <= reserveSeconds;
  const flightCritical = input.engineHealth < 0.42 ||
    input.flightControlHealth < 0.48;
  const missionSystemFailed =
    (state.assignedMission === "aew" && input.radarHealth < 0.45) ||
    (state.assignedMission === "anti-ship" && input.weaponSystemHealth < 0.38);

  if (fuelCritical || flightCritical || missionSystemFailed) {
    const reason = fuelCritical ? "fuel-reserve" :
      flightCritical ? "flight-damage" : "mission-system-damage";
    const next = transition(state, "return", input.time, reason);
    return { state: next, order: "return", navigationPoint: next.home };
  }

  if (state.assignedMission === "escort" && !input.protectedAssetAlive) {
    const next = transition(state, "return", input.time, "protected-asset-lost");
    return { state: next, order: "return", navigationPoint: next.home };
  }

  if (state.assignedMission === "anti-ship" && input.weaponsRemaining === 0 &&
      !input.hasAirborneWeapon) {
    const next = transition(state, "egress", input.time, "strike-complete");
    return { state: next, order: "egress", navigationPoint: next.home };
  }

  if ((state.assignedMission === "cap" ||
      state.assignedMission === "intercept") && input.hasEngaged &&
      input.contacts.every((contact) => contact.classification !== "aircraft") &&
      input.contactLostSeconds >= 20 && !input.hasAirborneWeapon) {
    const next = transition(state, "return", input.time, "contact-lost");
    return { state: next, order: "return", navigationPoint: next.home };
  }

  if (state.assignedMission === "aew") {
    const threats = input.contacts.filter((contact) =>
      contact.classification === "aircraft" && contact.quality >= 0.12);
    const nearest = threats.sort((left, right) =>
      distance(input.position, [left.position.x, left.position.y, left.position.z]) -
      distance(input.position, [right.position.x, right.position.y, right.position.z]))[0];
    const penetrationRange = input.escortAvailable ? 150 : 230;
    if (nearest && distance(input.position, [nearest.position.x, nearest.position.y,
      nearest.position.z]) < penetrationRange) {
      const dx = input.position.x - nearest.position.x;
      const dz = input.position.z - nearest.position.z;
      const length = Math.hypot(dx, dz) || 1;
      const station = [
        input.position.x + dx / length * 180,
        state.station[1],
        input.position.z + dz / length * 180,
      ] as const;
      const next = transition(state, "retreat", input.time, "threat-penetration", {
        station,
        retreatUntil: input.time + 45,
      });
      return { state: next, order: "aew", navigationPoint: station };
    }
    if (state.phase === "retreat" && input.time < state.retreatUntil)
      return {
        state: { ...state, updates: state.updates + 1 },
        order: "aew",
        navigationPoint: state.station,
      };
    const next = transition(state, "on-station", input.time, "orbit");
    return { state: next, order: "aew", navigationPoint: next.station };
  }

  const hostileContact = input.contacts.some((contact) =>
    contact.quality >= 0.1 &&
    (state.assignedMission === "anti-ship"
      ? contact.classification === "ship"
      : contact.classification === "aircraft"));
  const phase = hostileContact ? "commit" : "on-station";
  const next = transition(state, phase, input.time,
    hostileContact ? "observed-contact" : "assigned");
  return { state: next, order: state.assignedMission, navigationPoint: null };
}
