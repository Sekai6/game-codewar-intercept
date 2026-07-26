import type { FleetFormation, FleetFormationRole } from "./types.js";

export type FormationStation = readonly [number, number, number];

export interface FleetFormationOption {
  id: FleetFormation;
  label: string;
}

export const FLEET_FORMATION_OPTIONS: readonly FleetFormationOption[] = [
  { id: "screen", label: "Screen" },
  { id: "line-abreast", label: "Line abreast" },
  { id: "column", label: "Column" },
  { id: "dispersed", label: "Dispersed" },
];

export function parseFleetFormation(value: string | null | undefined): FleetFormation {
  return FLEET_FORMATION_OPTIONS.some((option) => option.id === value)
    ? value as FleetFormation
    : "screen";
}

/** Default relative slots in meters; scenarios may override individual entries. */
export function defaultFormationStation(
  formation: FleetFormation,
  index: number,
  role: FleetFormationRole,
): FormationStation {
  if (index === 0 || role === "command") return [0, 0, 0];
  const side = index % 2 === 0 ? 1 : -1;
  const rank = Math.ceil(index / 2);
  switch (formation) {
    case "line-abreast": return [side * rank * 95, 0, 0];
    case "column": return [0, 0, rank * 95];
    case "dispersed": return [side * rank * 130, 0, rank * 105];
    case "screen":
    default: return [side * rank * 85, 0, rank * 55];
  }
}
