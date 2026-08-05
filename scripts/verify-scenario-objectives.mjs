import assert from "node:assert/strict";
import { ScenarioObjectiveRuntime } from "../dist-test-scenario/scenario-system/objective-runtime.js";

const objectives=[
  {id:"protect",side:"blue",title:"Protect",description:"",kind:"protect",targetIds:["ship-a","ship-b"]},
  {id:"intercept",side:"blue",title:"Intercept",description:"",kind:"intercept",targetIds:["raid"],criteria:{forbiddenLaunchByFormationIds:["raid"],requiredWeaponIds:["KSR-5"]}},
  {id:"strike",side:"red",title:"Strike",description:"",kind:"strike",targetIds:["ship-a"],criteria:{requiredLaunchByFormationIds:["raid"],requiredWeaponIds:["KSR-5"]}},
  {id:"observe",side:"blue",title:"Observe",description:"",kind:"observe",targetIds:["ship-a"],criteria:{requiredSpaceWeatherPhases:["total-blackout","intermittent","recovery"]}},
];
const alive=new Map([["ship-a",true],["ship-b",true],["raid",true]]);
const runtime=new ScenarioObjectiveRuntime(objectives);
const evaluate=(time,phase="quiet",ended=false)=>runtime.evaluate({time,phase,ended,entityAlive:id=>alive.get(id)??false});
assert.equal(evaluate(0).length,0);
runtime.recordLaunch({time:10,side:"blue",platformId:"a6",formationId:"blue-strike",weaponId:"AGM-84A"});
assert.equal(evaluate(11).length,0,"unrelated Harpoon release must not satisfy or fail KSR-5 objectives");
runtime.recordLaunch({time:20,side:"red",platformId:"tu16-1",formationId:"raid",weaponId:"KSR-5"});
const launchTransitions=evaluate(21);
assert.equal(launchTransitions.find(x=>x.objectiveId==="intercept")?.state,"failed");
assert.equal(launchTransitions.find(x=>x.objectiveId==="strike")?.state,"complete");
evaluate(300,"total-blackout"); evaluate(720,"intermittent");
assert.equal(evaluate(960,"recovery").find(x=>x.objectiveId==="observe")?.state,"complete");
alive.set("ship-a",false); alive.set("ship-b",false);
assert.equal(evaluate(970,"recovery").find(x=>x.objectiveId==="protect")?.state,"failed");
console.log(JSON.stringify({launchTransitions,states:Object.fromEntries(objectives.map(x=>[x.id,runtime.state(x.id)]))},null,2));
