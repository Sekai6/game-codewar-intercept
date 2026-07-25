import { strict as assert } from "node:assert";
import {
  initialPilotState,
  pilotControlError,
  PILOT_MODELS,
  stepPilotState,
} from "../dist-test/air/ai/pilot-model.js";

assert.ok(PILOT_MODELS.ace.reactionSeconds < PILOT_MODELS.regular.reactionSeconds);
assert.ok(PILOT_MODELS.rookie.controlPrecision < PILOT_MODELS.regular.controlPrecision);
assert.ok(PILOT_MODELS.ace.gTolerance > PILOT_MODELS.rookie.gTolerance);

let state = initialPilotState();
state = stepPilotState({
  state,
  dt: 0.25,
  loadFactor: 1,
  contactCount: 2,
  threatCount: 1,
  supportingWeapon: true,
  damaged: false,
});
assert.ok(state.threatReactionRemaining > 0);
assert.ok(state.taskSaturation > 0.4);
const initialReaction = state.threatReactionRemaining;
for (let index = 0; index < 4; index++)
  state = stepPilotState({
    state,
    dt: 0.25,
    loadFactor: 7,
    contactCount: 4,
    threatCount: 1,
    supportingWeapon: true,
    damaged: true,
  });
assert.ok(state.threatReactionRemaining < initialReaction);
assert.ok(state.fatigue > 0);
assert.ok(state.gToleranceAvailable < 7.2);
assert.ok(state.effectiveControlPrecision < 0.88);
assert.ok(state.effectivePerceptionRefreshSeconds > 0.25);
assert.ok(state.effectiveTrackMemorySeconds < 18);

const first = pilotControlError({ pilotId: "blue-test-1", time: 12, state });
const repeat = pilotControlError({ pilotId: "blue-test-1", time: 12, state });
assert.deepEqual(first, repeat);

console.log(JSON.stringify({
  stress: state.stress,
  fatigue: state.fatigue,
  saturation: state.taskSaturation,
  gTolerance: state.gToleranceAvailable,
  reactionRemaining: state.threatReactionRemaining,
  controlPrecision: state.effectiveControlPrecision,
  perceptionRefresh: state.effectivePerceptionRefreshSeconds,
  trackMemory: state.effectiveTrackMemorySeconds,
  deterministicError: first,
}, null, 2));
