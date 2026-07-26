import type { ShipCombatantInstance } from "../ships/types.js";
import type { FleetCommandRole, NavalForceRuntime } from "./types.js";

function health(ship: ShipCombatantInstance, subsystem: "primaryRadar" | "fireControl") {
  return ship.subsystemHealth.get(subsystem) ?? 0;
}

function commandScore(force: NavalForceRuntime, ship: ShipCombatantInstance, role: FleetCommandRole) {
  const formationRole = force.formationRoles.get(ship.id);
  const hull = ship.hullIntegrity;
  if (role === "aawc") {
    return health(ship, "primaryRadar") * 1.4 + health(ship, "fireControl")
      + ship.illuminatorChannels * 12 + (formationRole === "command" ? 20 : 0);
  }
  if (role === "asuwc") {
    return health(ship, "primaryRadar") + ship.magazines.surfaceStrike * 4
      + (formationRole === "picket" ? 25 : 0);
  }
  return hull + health(ship, "primaryRadar") * 0.35
    + (formationRole === "command" ? 40 : 0);
}

function canCommand(ship: ShipCombatantInstance, role: FleetCommandRole) {
  if (!ship.alive || ship.hullIntegrity <= 0) return false;
  if (role === "aawc") return health(ship, "primaryRadar") > 20 && health(ship, "fireControl") > 20;
  if (role === "asuwc") return health(ship, "primaryRadar") > 15;
  return true;
}

export function reassessFleetCommand(force: NavalForceRuntime, now: number) {
  if (now - force.formationState.lastCommandReassessmentAt
      < force.doctrine.commandReassessmentSeconds) return false;
  force.formationState.lastCommandReassessmentAt = now;
  let changed = false;
  for (const role of ["otc", "aawc", "asuwc"] as const) {
    const currentId = force.commandRoles.get(role);
    const current = currentId ? force.ships.get(currentId) : undefined;
    if (current && canCommand(current, role)) continue;
    const successor = [...force.ships.values()]
      .filter((ship) => canCommand(ship, role))
      .sort((a, b) => commandScore(force, b, role) - commandScore(force, a, role))[0];
    if (!successor) {
      if (currentId) {
        force.commandRoles.delete(role);
        changed = true;
      }
      continue;
    }
    force.commandRoles.set(role, successor.id);
    changed ||= successor.id !== currentId;
    if (role === "otc") force.formationState.anchorShipId = successor.id;
  }
  return changed;
}
