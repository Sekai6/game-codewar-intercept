import assert from "node:assert/strict";
import { ScenarioCommandMessageRuntime } from "../dist-test/scenario-system/command-message-runtime.js";
const runtime=new ScenarioCommandMessageRuntime([{id:"m1",senderId:"a",recipientIds:["b"],createdAt:700,deliverAt:748,expiresAt:790,payloadType:"status-report",action:"reassess-defense"}]);
assert.equal(runtime.update(699,()=>({outcome:"acted",reason:"x"})).queued.length,0);
assert.equal(runtime.update(700,()=>({outcome:"acted",reason:"x"})).queued.length,1);
const delivery=runtime.update(748,()=>({outcome:"acted",reason:"sector-changed"})).deliveries[0];
assert.equal(delivery.outcome,"acted");
assert.equal(runtime.update(749,()=>({outcome:"acted",reason:"duplicate"})).deliveries.length,0);
console.log(JSON.stringify(delivery));
