import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1","--disable-background-networking"]});
const page=await browser.newPage({viewport:{width:1100,height:620}}),errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push(m.text())}); page.on("pageerror",e=>errors.push(e.message));
try{
 await page.goto("http://127.0.0.1:5173/?validationTimeScale=32",{waitUntil:"domcontentloaded",timeout:15000});
 await page.locator("#sbHighQualityEnvironment").uncheck(); await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
 await page.locator("#sbStart").click(); await page.locator(".scenario-briefing [data-begin]").click();
 await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.simulationElapsed??0)>=560,null,{timeout:130000});
 const result=await page.locator("#scene").evaluate(canvas=>({elapsed:Number(canvas.dataset.simulationElapsed),launches:canvas.dataset.airWeaponLaunchLog??"",shipLaunches:canvas.dataset.airDefenseLaunchers??"",hitLog:canvas.dataset.airWeaponHitLog??"",actualRate:Number(canvas.dataset.actualSimulationRate??0),missions:canvas.dataset.airMissionStates??"",a6:JSON.parse(canvas.dataset.advancedAirMissionDiagnostics??"[]").filter(x=>x.id.includes("A-6E"))}));
 const ksr=result.launches.split("|").filter(x=>x.includes("KSR-5"));
 const harpoon=result.launches.split("|").filter(x=>x.includes("AGM-84A"));
 console.log(JSON.stringify({...result,ksrCount:ksr.length,harpoonCount:harpoon.length,errors},null,2));
 assert.equal(errors.length,0); assert.ok(ksr.length>=3&&ksr.length<=6); assert.ok(harpoon.length>=1,"A-6E must make a legal Harpoon release in the fixed seed");
 assert.ok(result.shipLaunches.includes("blue-cg-57"),"CG-57 must use its physical launcher path");
 assert.ok(result.shipLaunches.includes("blue-long-beach"),"Long Beach must use its physical launcher path");
 assert.ok(!ksr.some(x=>Number(x.match(/RANGE ([\d.]+)/)?.[1])<0));
}finally{await browser.close()}
