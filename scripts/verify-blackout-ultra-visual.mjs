import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader","--renderer-process-limit=1","--disable-background-networking"],
});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[];
page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationScenarioOffset=300`,{waitUntil:"domcontentloaded",timeout:15_000});
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbHighQualityEnvironment").check();
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.simulationElapsed??0)>=300,null,{timeout:20_000});
  await page.waitForTimeout(1200);
  const diagnostics=await page.locator("#scene").evaluate(canvas=>({
    elapsed:canvas.dataset.simulationElapsed,
    phase:canvas.dataset.spaceWeatherPhase,
    intensity:canvas.dataset.spaceWeatherIntensity,
    timeOfDay:canvas.dataset.environmentTimeOfDay,
    sunAltitude:canvas.dataset.environmentSunAltitudeDeg,
    highQuality:canvas.dataset.highQualityEnvironment,
    auroraControlled:canvas.dataset.auroraEnvironmentControlled,
  }));
  await page.screenshot({path:"verification-v121-blackout-ultra.png",fullPage:true});
  console.log(JSON.stringify({diagnostics,errors},null,2));
  if(errors.length||diagnostics.phase!=="total-blackout"||Number(diagnostics.intensity)<.95
    ||diagnostics.timeOfDay!=="polar-twilight"||Number(diagnostics.sunAltitude)>=0
    ||diagnostics.highQuality!=="true"||diagnostics.auroraControlled!=="true")process.exitCode=1;
}finally{await browser.close();}
