import assert from "node:assert/strict";
import { fleetVisualCommands } from "../dist-test/fleet/visuals.js";
const fleet = { members: [
  { id: "otc", x: 0, y: 0, z: 0, commandRoles: ["otc"], formationRole: "command", stationError: 0 },
  { id: "screen", x: 20, y: 0, z: 10, commandRoles: [], formationRole: "picket", stationError: 10 },
], tracks: [{ id: "M-1", x: 100, y: 4, z: 0 }], assignments: [{ shooterId: "screen", targetId: "M-1", status: "accepted", weaponsAway: 0 }] };
const commands = fleetVisualCommands(fleet);
assert.equal(commands.filter((command) => command.kind === "member").length, 2);
assert.equal(commands.filter((command) => command.kind === "formation-line").length, 1);
assert.equal(commands.filter((command) => command.kind === "station-error")[0].radius, .8);
assert.equal(commands.filter((command) => command.kind === "task-line")[0].color, 0xffd166);
console.log(JSON.stringify({ commands: commands.length, taskColor: "assigned" }));
