export type AirTacticalMode =
  | "mission"
  | "commit"
  | "support"
  | "crank"
  | "notch"
  | "drag"
  | "pump"
  | "bfm-one-circle"
  | "bfm-two-circle"
  | "bfm-lag-pursuit"
  | "bfm-scissors"
  | "bfm-defensive-turn";

export interface AirTacticalState {
  mode: AirTacticalMode;
  enteredAt: number;
  targetTrackNumber: string | null;
  supportedWeaponId: string | null;
  energyPriority: "preserve" | "neutral" | "spend";
  formationRole: import("./formation-tactics.js").FormationTacticalRole;
  formationCommandSlot: number;
  formationTrackNumber: string | null;
  threatPhase: import("./threat-response.js").ThreatResponsePhase;
  commandedBankLimitDeg: number | null;
  commandedLoadFactor: number | null;
  bfmShotWindowSeconds: number;
  lastTacticalEvaluationAt: number;
  lastLaunchZone: {
    rMin: number;
    rNe: number;
    rTr: number;
    rMax: number;
    range: number;
  } | null;
}

export const initialAirTacticalState = (): AirTacticalState => ({
  mode: "mission",
  enteredAt: 0,
  targetTrackNumber: null,
  supportedWeaponId: null,
  energyPriority: "neutral",
  formationRole: "lead",
  formationCommandSlot: 0,
  formationTrackNumber: null,
  threatPhase: "monitor",
  commandedBankLimitDeg: null,
  commandedLoadFactor: null,
  bfmShotWindowSeconds: 0,
  lastTacticalEvaluationAt: 0,
  lastLaunchZone: null,
});

export function transitionTacticalState(
  current: AirTacticalState,
  next: AirTacticalMode,
  time: number,
  minimumHoldSeconds = 0.8,
) {
  if (current.mode === next || time - current.enteredAt < minimumHoldSeconds)
    return current;
  return { ...current, mode: next, enteredAt: time };
}
