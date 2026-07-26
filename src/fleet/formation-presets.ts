import type { FleetFormation, FleetFormationRole } from "./types.js";

export type FormationStation = readonly [number, number, number];

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
