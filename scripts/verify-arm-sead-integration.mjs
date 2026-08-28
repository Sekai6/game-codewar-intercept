import assert from "node:assert/strict";
import * as THREE from "three";
import { ArmEmitterRuntime } from "../src/arm/emitter-runtime.ts";
import { ARM_EMITTERS } from "../src/arm/catalog.ts";
import { armReleaseAuthorization } from "../src/arm/mission-integration.ts";

const emitters = new ArmEmitterRuntime();
emitters.register({ id: "cg57:primary-emitter", platformId: "cg57", definition: ARM_EMITTERS["AN-SPY-1-search"], position: new THREE.Vector3(100, 0, 0) });
emitters.setActive("cg57:primary-emitter", true, 1, "search");
const aircraft = { mission: "sead" };
const track = {
  targetId: "cg57", position: new THREE.Vector3(100, 0, 0), velocity: new THREE.Vector3(),
  quality: .7, uncertainty: 10, lastUpdate: 2, classification: "ship", engagementQuality: "cue",
  passive: { source: "esm", bearingDeg: 90, bearingUncertaintyDeg: 4, signalStrength: .8, emitterType: "radar", emitterId: "cg57:primary-emitter", passiveOnly: true },
};
const allowed = armReleaseAuthorization({ aircraft, track, emitters, time: 2 });
assert.equal(allowed.allowed, true);
assert.equal(allowed.emitterId, "cg57:primary-emitter");
assert.equal(armReleaseAuthorization({ aircraft, track: { ...track, passive: undefined }, emitters, time: 2 }).allowed, false);
assert.equal(armReleaseAuthorization({ aircraft, track: { ...track, lastUpdate: -20 }, emitters, time: 2 }).allowed, false);
console.log("ARM SEAD integration verification passed");
