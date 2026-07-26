import type { FleetObservation } from "./observability.js";

export type FleetVisualCommand =
  | { kind: "member"; id: string; x: number; y: number; z: number; color: number }
  | { kind: "formation-line"; from: [number, number, number]; to: [number, number, number]; color: number }
  | { kind: "station-error"; x: number; y: number; z: number; radius: number; color: number }
  | { kind: "task-line"; from: [number, number, number]; to: [number, number, number]; color: number }
  | { kind: "task-arrow"; at: [number, number, number]; to: [number, number, number]; color: number };

export function fleetVisualCommands(fleet: FleetObservation): FleetVisualCommand[] {
  const commands: FleetVisualCommand[] = [];
  const ships = new Map(fleet.members.map((member) => [member.id, member]));
  const tracks = new Map(fleet.tracks.map((track) => [track.id, track]));
  const anchor = fleet.members.find((member) => member.commandRoles.includes("otc"));
  for (const member of fleet.members) {
    const color = member.commandRoles.includes("aawc")
      ? 0xffe06a
      : member.formationRole === "picket" ? 0x8fd8ff : 0x9aa8b8;
    commands.push({ kind: "member", id: member.id, x: member.x, y: member.y, z: member.z, color });
    if (anchor && member.id !== anchor.id) {
      commands.push({ kind: "formation-line", from: [anchor.x, anchor.y + 2, anchor.z], to: [member.x, member.y + 2, member.z], color });
      commands.push({ kind: "station-error", x: member.x, y: member.y, z: member.z, radius: Math.min(5.5, Math.max(.8, member.stationError * .08)), color });
    }
  }
  for (const assignment of fleet.assignments) {
    const shooter = ships.get(assignment.shooterId), track = tracks.get(assignment.targetId);
    if (!shooter || !track) continue;
    const color = assignment.status === "weapons-away" || assignment.weaponsAway > 0 ? 0xff6a5f : 0xffd166;
    const from: [number, number, number] = [shooter.x, shooter.y + 4, shooter.z];
    const to: [number, number, number] = [track.x, track.y + 4, track.z];
    commands.push({ kind: "task-line", from, to, color });
    commands.push({ kind: "task-arrow", at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], to, color });
  }
  return commands;
}
