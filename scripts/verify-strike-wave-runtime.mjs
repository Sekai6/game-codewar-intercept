import assert from "node:assert/strict";
import { StrikeWaveRuntime } from "../dist-test/air/strike-wave-runtime.js";

const runtime=new StrikeWaveRuntime();
runtime.configure([{id:"main",side:"red",shooterIds:["a","b","c","d"],targetCandidates:["lb","cg"],plannedLaunchWindow:[300,600],minimumShooters:3,maximumShooters:4,maximumWeaponsPerTarget:3}]);
const status=(ready=4)=>["a","b","c","d"].map((id,index)=>({id,alive:true,weaponReady:index<ready,inLaunchZone:index<ready,missionValid:true}));
runtime.update("main",299,status());
assert.equal(runtime.snapshot("main").state,"holding");
assert.equal(runtime.allows("main","a"),false);
runtime.update("main",300,status(2));
assert.equal(runtime.snapshot("main").state,"holding");
runtime.update("main",360,status());
assert.deepEqual(runtime.snapshot("main").authorizedShooters,["a","b","c","d"]);
runtime.recordLaunch("main","a"); runtime.recordLaunch("main","b");
runtime.update("main",365,status());
assert.equal(runtime.allows("main","c"),true,"remaining members stay authorized after first releases");
runtime.recordLaunch("main","c"); runtime.recordLaunch("main","d");
assert.equal(runtime.snapshot("main").state,"egressing");
console.log(JSON.stringify(runtime.snapshot("main")));
