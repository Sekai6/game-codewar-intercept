import assert from "node:assert/strict";
import * as THREE from "three";
import { ARM_WEAPONS } from "../src/arm/catalog.ts";
import { updateArmSeeker } from "../src/arm/seeker-runtime.ts";

const base = { id: "cg57:fire-control-emitter", platformId: "cg57", definitionId: "AN-SPG-49-fire-control", position: new THREE.Vector3(80, 0, 0), active: true, mode: "guidance", emissionStrength: 1, lastActivatedAt: 0, lastDeactivatedAt: 0, health: 1, decoy: false, band: "X" };
const step = (state, profile, emitter, time, sample = .1) => updateArmSeeker({ state, profile, missilePosition: new THREE.Vector3(), emitters: [emitter], time, dt: .2, sample });

const shrike = { mode: "emitter-search", targetEmitterId: undefined };
step(shrike, ARM_WEAPONS["AGM-45A"], base, 1);
assert.equal(shrike.mode, "emitter-acquired");
const silent = { ...base, active: false, emissionStrength: 0 };
step(shrike, ARM_WEAPONS["AGM-45A"], silent, 2);
assert.equal(shrike.mode, "memory-track");
step(shrike, ARM_WEAPONS["AGM-45A"], silent, 11);
assert.equal(shrike.mode, "lost");

const harm = { mode: "emitter-search", targetEmitterId: undefined };
step(harm, ARM_WEAPONS["AGM-88A"], base, 1);
assert.equal(harm.mode, "emitter-acquired");
step(harm, ARM_WEAPONS["AGM-88A"], silent, 2);
assert.equal(harm.mode, "memory-track");
step(harm, ARM_WEAPONS["AGM-88A"], silent, 27);
assert.equal(harm.mode, "reacquisition");
step(harm, ARM_WEAPONS["AGM-88A"], base, 28, .1);
assert.equal(harm.mode, "terminal-home");
console.log("ARM seeker lifecycle verification passed");
