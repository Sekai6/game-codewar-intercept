import * as THREE from "three";
import { SovietMaritimeTargetingNetwork } from "../dist-test/soviet-c2/maritime-targeting.js";

const participant = {
  id: "red-TU-16K-1",
  platformId: "TU-16K",
  position: new THREE.Vector3(80, 92, -1050),
  alive: true,
};
const target = {
  id: "blue-surface-ship",
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(0.8, 0, -0.2),
  radarCrossSection: 12000,
  alive: true,
};

function runUntilCue(era, start = 0, end = 80) {
  const network = new SovietMaritimeTargetingNetwork();
  network.reset(era, true);
  let cue;
  for (let time = start; time <= end; time += 0.25) {
    network.update(time, [participant], [target]);
    cue = network.cueFor(participant.id, time) ?? cue;
  }
  return { network, cue };
}

const early = runUntilCue("early-cold-war");
if (early.cue || early.network.diagnostics(80).enabled)
  throw new Error("Early Cold War incorrectly exposes maritime targeting");

const ocean = runUntilCue("ocean-navy");
if (!ocean.cue || ocean.cue.source !== "uspekh-u")
  throw new Error("Ocean Navy did not deliver an Uspekh-U target-area cue");

const ntu = runUntilCue("ntu-1980s", 0, 10);
if (!ntu.cue || ntu.cue.source !== "legenda")
  throw new Error("NTU era did not use an active Legenda pass");
if ("targetId" in ntu.cue || ntu.cue.reportTrackId.includes(target.id))
  throw new Error("Maritime cue leaked the target entity identity");
if (ntu.cue.deliveredAt <= ntu.cue.observedAt || ntu.cue.uncertaintyMajor <= ntu.cue.uncertaintyMinor)
  throw new Error("Maritime cue lacks delay or a valid uncertainty ellipse");
if (ntu.cue.estimatedPosition.distanceTo(target.position) < 0.01)
  throw new Error("Maritime cue exposed the exact target position");
if (ntu.cue.launchRegionCenter.distanceTo(ntu.cue.estimatedPosition) < 300)
  throw new Error("Maritime cue did not produce a stand-off launch region");

const expiredAt = ntu.cue.expiresAt + 80;
for (let time = 10.25; time <= expiredAt; time += 0.25)
  ntu.network.update(time, [participant], []);
if (ntu.network.cueFor(participant.id, expiredAt))
  throw new Error("Stale maritime cue did not expire");
ntu.network.configure("ntu-1980s", false);
ntu.network.update(expiredAt + 1, [participant], [target]);
if (ntu.network.cueFor(participant.id, expiredAt + 1) || ntu.network.diagnostics(expiredAt + 1).enabled)
  throw new Error("Disabled maritime targeting retained an active cue");

console.log(JSON.stringify({
  early: early.network.diagnostics(80),
  ocean: { diagnostics: ocean.network.diagnostics(80), cue: ocean.cue },
  ntu: { diagnostics: ntu.network.diagnostics(10), cue: ntu.cue },
}, null, 2));
