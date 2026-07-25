import * as THREE from "three";
import { SOVIET_COMMAND_ERAS } from "../dist-test/soviet-c2/era.js";
import { SovietGciNetwork } from "../dist-test/soviet-c2/gci-network.js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(SOVIET_COMMAND_ERAS["early-cold-war"].gciAvailable, "early GCI capability missing");
assert(!SOVIET_COMMAND_ERAS["early-cold-war"].legendaAvailable, "Legenda available too early");
assert(SOVIET_COMMAND_ERAS["ntu-1980s"].uspekhAvailable, "NTU Uspekh-U capability missing");
assert(SOVIET_COMMAND_ERAS["ntu-1980s"].legendaAvailable, "NTU Legenda capability missing");

const participant = { id: "red-MIG-29A-1", platformId: "MIG-29A", position: new THREE.Vector3(65, 68, -1080), velocity: new THREE.Vector3(0, 0, 5.3), alive: true };
const target = { id: "blue-F-14A-1", position: new THREE.Vector3(-50, 72, -600), velocity: new THREE.Vector3(0, 0, -5.2), radarCrossSection: 10, alive: true };
function run(era) {
  const network = new SovietGciNetwork();
  network.reset(era, true);
  let command;
  for (let time = 0; time <= 90; time += .2) {
    network.update(time, [participant], [target]);
    command ??= network.commandFor(participant.id, time);
  }
  return { network, command, diagnostics: network.diagnostics(90) };
}
const ntu = run("ntu-1980s"), repeat = run("ntu-1980s"), early = run("early-cold-war");
assert(ntu.command, "NTU GCI did not deliver an intercept command");
assert(ntu.command.controllerTrackId.startsWith("GCI-"), "controller track identity missing");
assert(!("targetId" in ntu.command), "GCI command leaked target truth identity");
assert(ntu.command.deliveredAt > ntu.command.observedAt, "GCI command bypassed transmission delay");
assert(ntu.command.uncertainty > 0 && ntu.command.quality < 1, "GCI command lacks measurement uncertainty");
assert(ntu.command.interceptPoint.distanceTo(target.position) > 1, "GCI command copied target truth position");
assert(ntu.command.interceptPoint.distanceTo(repeat.command.interceptPoint) < 1e-9, "GCI result is not deterministic");
assert(early.diagnostics.meanDelay > ntu.diagnostics.meanDelay, `early GCI is not slower than NTU GCI (${early.diagnostics.meanDelay} <= ${ntu.diagnostics.meanDelay})`);
for (let time = 91; time <= 160; time += 1) ntu.network.update(time, [participant], []);
assert(!ntu.network.commandFor(participant.id, 160), "stale GCI command did not expire");
ntu.network.configure("ntu-1980s", false);
ntu.network.update(161, [participant], [target]);
assert(!ntu.network.commandFor(participant.id, 161) && !ntu.network.diagnostics(161).enabled, "disabled GCI remained operational");
console.log(JSON.stringify({ ntu: ntu.diagnostics, early: early.diagnostics, command: ntu.command }, null, 2));
