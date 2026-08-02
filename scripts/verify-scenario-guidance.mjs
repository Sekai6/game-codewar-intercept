import assert from "node:assert/strict";
import { ScenarioGuidanceRuntime } from "../dist-test/scenario-system/guidance-runtime.js";

const definition = { briefing:{ strategicBackground:[], blueMission:[], intelligenceEstimate:[], features:[], controls:[] }, estimatedContactWindow:[100,200], cues:[
  { id:"time",level:"full",trigger:{type:"time",at:20},title:"Time",message:"Observed plan",category:"mission",expiresAfter:5,once:true },
  { id:"network",level:"critical",trigger:{type:"network-state",side:"blue",state:"disconnected"},title:"Lost",message:"Observed network",category:"network",once:true },
  { id:"track",level:"full",trigger:{type:"confirmed-track",side:"blue",classification:"aircraft"},title:"Track",message:"Confirmed only",category:"sensor",once:true },
  { id:"launch",level:"critical",trigger:{type:"weapon-launch",side:"blue",platformId:"blue-cg-57"},title:"Launch",message:"Physical launch",category:"combat",once:true },
  { id:"objective",level:"critical",trigger:{type:"objective-state",objectiveId:"protect-fleet",state:"failed"},title:"Failed",message:"Observed objective",category:"mission",once:true },
  { id:"idle",level:"full",trigger:{type:"inactivity",seconds:45},title:"Idle",message:"Observe",category:"mission",once:false },
] };

const runtime = new ScenarioGuidanceRuntime(definition, "full");
runtime.update(25);
assert.equal(runtime.snapshot().activeCue.cue.id,"time","time crossing survives coarse time steps");
runtime.setPaused(true); runtime.update(200);
assert.equal(runtime.snapshot().scenarioTime,25,"paused updates do not advance guidance time");
runtime.observe({type:"objective-state",objectiveId:"protect-fleet",state:"failed"},150);
assert.equal(runtime.snapshot().scenarioTime,25,"observations cannot advance guidance clock while paused");
runtime.setPaused(false); runtime.update(31);
assert.equal(runtime.snapshot().activeCue.cue.id,"objective","objective changes produce explicit guidance");
runtime.dismissCurrent();
runtime.observe({type:"network-state",side:"red",state:"disconnected"},32);
assert.equal(runtime.snapshot().activeCue,undefined,"other side observation does not leak/trigger");
runtime.observe({type:"network-state",side:"blue",state:"disconnected"},33);
assert.equal(runtime.snapshot().activeCue.cue.id,"network");
runtime.dismissCurrent(); runtime.observe({type:"network-state",side:"blue",state:"disconnected"},34);
assert.equal(runtime.snapshot().activeCue,undefined,"once cue does not repeat");
runtime.update(80);
assert.equal(runtime.snapshot().activeCue.cue.id,"idle","inactivity uses simulation time");
runtime.dismissCurrent();
runtime.observe({type:"weapon-launch",side:"blue",platformId:"blue-cg-57",launchId:"",weaponId:"SM-2MR",launcherId:"MK41:AFT",targetTrackId:"track-1",releaseSource:"ship-launcher",physicalRelease:true},81);
assert.equal(runtime.snapshot().activeCue,undefined,"incomplete launch evidence is rejected");
runtime.observe({type:"weapon-launch",side:"blue",platformId:"blue-cg-57",launchId:"launch-1",weaponId:"SM-2MR",launcherId:"MK41:AFT",targetTrackId:"track-1",releaseSource:"ship-launcher",physicalRelease:true},82);
assert.equal(runtime.snapshot().activeCue.cue.id,"launch","physical entity launch is accepted");
assert.ok(runtime.drainAuditEvents().some((event) => event.action === "cue-activated" && event.cueId === "launch"),"AAR stream identifies cue without target truth");

const critical = new ScenarioGuidanceRuntime(definition,"critical");
critical.update(25);
assert.equal(critical.snapshot().activeCue,undefined,"critical mode filters full cues");
critical.observe({type:"network-state",side:"blue",state:"disconnected"},26);
assert.equal(critical.snapshot().activeCue.cue.id,"network");
critical.update(400);
assert.equal(critical.snapshot().activeCue.cue.id,"network","non-expiring critical cue survives large time multiplier step");
critical.setMode("off");
critical.observe({type:"confirmed-track",side:"blue",classification:"aircraft"},27);
assert.equal(critical.snapshot().activeCue,undefined,"off suppresses all cues");
console.log("Scenario guidance runtime verification passed.");
