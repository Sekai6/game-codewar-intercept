import * as THREE from "three";
import { createNavalForceRuntime } from "../dist-test/fleet/force-runtime.js";
import { NAVAL_FORCE_SCENARIOS } from "../dist-test/fleet/scenarios.js";

const definition = (id, sm2mr) => ({
  id, name:id, hullNumber:id, era:"test", role:"test",
  platform:{patrolSpeedKnots:10,radarRcs:10},
  ammo:{rim67:id==="long-beach"?6:0,sm2mr,sm2er:8,ciws:1200,channels:3,illuminators:2},
  surfaceStrike:{magazine:8},
  build:()=>new THREE.Group(),
});
const definitions = new Map([
  ["long-beach", definition("long-beach", 12)],
  ["ticonderoga", definition("ticonderoga", 48)],
]);
const force = createNavalForceRuntime(NAVAL_FORCE_SCENARIOS["blue-ntu-screen"], definitions);
const longBeach = force.ships.get("blue-cgn-9");
const ticonderoga = force.ships.get("blue-cg-57");
if (!longBeach || !ticonderoga) throw new Error("Fleet members missing");

longBeach.magazines.rounds.set("SM-2MR", 1);
longBeach.localTracks.set("threat-1", {
  targetId:"threat-1",position:longBeach.position.clone(),velocity:longBeach.velocity.clone(),
  quality:.8,uncertainty:4,classification:"missile",source:"local-radar",updatedAt:1,weaponQuality:true,
});
longBeach.applyDamage(12, longBeach.position);

const result = {
  ships: force.ships.size,
  otc: force.commandRoles.get("otc"),
  aawc: force.commandRoles.get("aawc"),
  asuwc: force.commandRoles.get("asuwc"),
  link11RequiresLocalTrack: force.doctrine.requireLocalFireControlTrack && !force.doctrine.networkTracksProvideWeaponAuthority,
  independentAmmo: ticonderoga.magazines.rounds.get("SM-2MR") === 48,
  independentTracks: ticonderoga.localTracks.size === 0 && longBeach.localTracks.size === 1,
  independentDamage: longBeach.hullIntegrity === 88 && ticonderoga.hullIntegrity === 100,
  independentModels: longBeach.model !== ticonderoga.model && longBeach.position !== ticonderoga.position,
};
console.log(JSON.stringify(result, null, 2));
if (result.ships !== 2 || result.otc !== "blue-cgn-9" || result.aawc !== "blue-cgn-9" || result.asuwc !== "blue-cg-57" || !result.link11RequiresLocalTrack || !result.independentAmmo || !result.independentTracks || !result.independentDamage || !result.independentModels) process.exitCode = 1;
