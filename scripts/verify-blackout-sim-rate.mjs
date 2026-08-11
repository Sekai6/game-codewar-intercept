import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1","--disable-background-networking"]});
const results=[];
try{
  for(const requested of [16,32]){
    const page=await browser.newPage({viewport:{width:960,height:540}}),start=performance.now();
    await page.goto(`http://127.0.0.1:5173/?validationTimeScale=${requested}`,{waitUntil:"domcontentloaded",timeout:15000});
    await page.locator("#sbHighQualityEnvironment").uncheck();
    await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
    await page.locator("#sbStart").click(); await page.locator(".scenario-briefing [data-begin]").click();
    await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.simulationElapsed??0)>=240,null,{timeout:90000});
    results.push({requested,wallSeconds:(performance.now()-start)/1000,...await page.locator("#scene").evaluate(canvas=>({actual:Number(canvas.dataset.actualSimulationRate??0),limited:canvas.dataset.simRateLimited}))});
    await page.close();
  }
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));
assert.ok(results[1].wallSeconds<results[0].wallSeconds,"32x must advance 240 simulated seconds faster than 16x");
assert.ok(results[1].actual>results[0].actual,"reported 32x actual rate must exceed 16x");
