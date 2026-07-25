import { chromium } from "playwright-core";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1"]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text());});page.on("pageerror",(error)=>errors.push(error.message));
  await page.goto(process.env.APP_URL??"http://127.0.0.1:5173/?shortAirValidation=1",{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbAirCombat").check();await page.locator("#sbStart").click();
  await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.shipSamShots??0)>=1,null,{timeout:30000});
  await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.shipInterceptorBoostersSeparated??0)>=1,null,{timeout:15000});
  const result=await page.locator("#scene").evaluate((canvas)=>({shots:Number(canvas.dataset.shipSamShots??0),launchers:canvas.dataset.airDefenseLaunchers??"",targets:canvas.dataset.airDefenseTargetCategories??"",visuals:canvas.dataset.shipInterceptorVisuals??"",boosters:Number(canvas.dataset.shipInterceptorBoostersSeparated??0)}));result.errors=errors;console.log(JSON.stringify(result,null,2));
  if(errors.length||result.shots<1||!/MK 10|MK 41/.test(result.launchers)||!result.targets.includes("missile")||!result.visuals.includes(":+Y")||result.visuals.includes("missing")||result.boosters<1)process.exitCode=1;
}finally{await browser.close();}
