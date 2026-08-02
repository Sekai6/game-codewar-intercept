import assert from "node:assert/strict";
import { SpaceWeatherTimelineRuntime } from "../dist-test/space-weather/timeline-runtime.js";
import { evaluatePropagation } from "../dist-test/space-weather/propagation-effects.js";

const expected=[[0,"quiet"],[150,"warning"],[210,"solar-flare"],[300,"total-blackout"],[720,"intermittent"],[960,"recovery"],[1080,"recovery"]];
for(const preset of ["EXTREME_SPACE_WEATHER","TOTAL_BAND_DENIAL"]) {
  const runtime=new SpaceWeatherTimelineRuntime(preset);
  for(const [time,phase] of expected) assert.equal(runtime.snapshotAt(time).phase,phase);
  assert.deepEqual(runtime.snapshotAt(437.25),runtime.snapshotAt(437.25),"timeline must be deterministic");
  assert.equal(runtime.snapshotAt(-5).time,0); assert.equal(runtime.snapshotAt(2000).time,1080);
}
const extreme=new SpaceWeatherTimelineRuntime("EXTREME_SPACE_WEATHER").snapshotAt(300);
const denial=new SpaceWeatherTimelineRuntime("TOTAL_BAND_DENIAL").snapshotAt(300);
assert.ok(denial.hfAvailability<extreme.hfAvailability);
assert.ok(denial.vhfUhfReliability<extreme.vhfUhfReliability);
const denialRuntime=new SpaceWeatherTimelineRuntime("TOTAL_BAND_DENIAL");
assert.equal(denialRuntime.snapshotAt(760).communicationWindowOpen,true);
assert.equal(denialRuntime.snapshotAt(790).communicationWindowOpen,false);
assert.ok(denialRuntime.snapshotAt(760).vhfUhfReliability>denialRuntime.snapshotAt(790).vhfUhfReliability);
const input={channel:"link11",messageId:"M-1",senderId:"CG-57",recipientId:"CGN-9",baseQuality:.9,baseDelaySeconds:1,baseSuccessProbability:.95,rangeRatio:.4};
const nominal=evaluatePropagation(new SpaceWeatherTimelineRuntime("TOTAL_BAND_DENIAL").snapshotAt(0),input);
const blackout=evaluatePropagation(denial,input);
assert.deepEqual(blackout,evaluatePropagation(denial,input),"propagation must be repeatable");
assert.ok(blackout.successProbability<nominal.successProbability);
assert.ok(blackout.delaySeconds>nominal.delaySeconds);
assert.ok(blackout.qualityMultiplier<nominal.qualityMultiplier);
const channels=["link11","link16","hf","vhf-uhf","satellite","soviet-gci","soviet-maritime-c2"];
for(const channel of channels) { const value=evaluatePropagation(denial,{...input,channel});
  assert.ok(value.successProbability>=0&&value.successProbability<=1); assert.ok(value.delaySeconds>=1); }
console.log(JSON.stringify({nominal,blackout,phases:expected.map(([time])=>new SpaceWeatherTimelineRuntime().snapshotAt(time))},null,2));
