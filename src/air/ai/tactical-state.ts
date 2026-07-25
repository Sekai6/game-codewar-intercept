export type AirTacticalMode =
  | "mission"
  | "commit"
  | "support"
  | "crank"
  | "notch"
  | "drag"
  | "pump";

export interface AirTacticalState {
  mode: AirTacticalMode;
  enteredAt: number;
  targetTrackNumber: string | null;
  supportedWeaponId: string | null;
  energyPriority: "preserve" | "neutral" | "spend";
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
