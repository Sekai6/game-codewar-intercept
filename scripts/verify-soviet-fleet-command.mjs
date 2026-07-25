import * as THREE from "three";
import { SovietFleetCommandNetwork } from "../dist-test/soviet-c2/fleet-command.js";

const participant = {
  id: "red-TU-16K-1",
  platformId: "TU-16K",
  position: new THREE.Vector3(80, 92, -800),
  alive: true,
};
const liveNode = { id: "red-flagship", label: "SURFACE FLAG RELAY", alive: true, health: 0.82 };
const deadNode = { ...liveNode, alive: false, health: 0 };
const area = {
  reportTrackId: "RORSAT-200871f0",
  estimatedPosition: new THREE.Vector3(24, 0, 42),
  launchRegionCenter: new THREE.Vector3(45, 92, -377),
  quality: 0.67,
  observedAt: 0,
  expiresAt: 80,
};

function run(era) {
  const network = new SovietFleetCommandNetwork();
  network.reset(era, true);
  let order;
  for (let time = 0; time <= 20; time += 0.25) {
    network.update(time, liveNode, [participant], new Map([[participant.id, area]]));
    order = network.orderFor(participant.id, time) ?? order;
  }
  return { network, order };
}

const early = run("early-cold-war");
if (early.order || early.network.diagnostics(20).enabled)
  throw new Error("Early Cold War incorrectly enabled fleet command automation");

const ntu = run("ntu-1980s");
if (!ntu.order) throw new Error("NTU fleet command did not deliver a strike order");
if ("targetId" in ntu.order || ntu.order.sourceReportTrackId.includes("blue-surface-ship"))
  throw new Error("Fleet order leaked target truth identity");
if (ntu.order.deliveredAt <= ntu.order.issuedAt || ntu.order.attackWindowStart <= ntu.order.deliveredAt)
  throw new Error("Fleet order lacks transmission delay or a future attack window");
if (ntu.order.approachPoint.distanceTo(area.launchRegionCenter) < 20)
  throw new Error("Fleet command did not assign an approach axis");

const transmittedBeforeLoss = ntu.network.diagnostics(20).transmitted;
ntu.network.update(21, deadNode, [participant], new Map([[participant.id, area]]));
if (!ntu.network.orderFor(participant.id, 21))
  throw new Error("Node loss incorrectly erased a previously delivered order");
for (let time = 21.25; time <= ntu.order.expiresAt + 1; time += 0.25)
  ntu.network.update(time, deadNode, [participant], new Map([[participant.id, area]]));
const afterLoss = ntu.network.diagnostics(ntu.order.expiresAt + 1);
if (afterLoss.transmitted !== transmittedBeforeLoss || ntu.network.orderFor(participant.id, ntu.order.expiresAt + 1))
  throw new Error("Dead command node transmitted a new order or stale order did not expire");

ntu.network.configure("ntu-1980s", false);
ntu.network.update(ntu.order.expiresAt + 2, liveNode, [participant], new Map([[participant.id, area]]));
if (ntu.network.diagnostics(ntu.order.expiresAt + 2).enabled)
  throw new Error("Fleet-command master switch did not disable the network");

console.log(JSON.stringify({
  early: early.network.diagnostics(20),
  order: ntu.order,
  afterNodeLoss: afterLoss,
}, null, 2));
