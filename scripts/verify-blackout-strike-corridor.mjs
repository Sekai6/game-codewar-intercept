import { chromium } from "playwright-core";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1","--disable-background-networking"]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push(m.text());}); page.on("pageerror",e=>errors.push(e.message));
try {
  await page.goto(process.env.APP_URL??"http://127.0.0.1:5173/?validationTimeScale=16",{waitUntil:"domcontentloaded",timeout:15_000});
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click(); await page.locator(".scenario-briefing [data-begin]").click();
  let reached=false;
  try { await page.waitForFunction(()=>{
    const canvas=document.querySelector("#scene");
    const objectives=canvas?.dataset.scenarioObjectives??"";
    return objectives.includes("intercept-badgers:complete")||objectives.includes("intercept-badgers:failed")||Number(canvas?.dataset.simulationElapsed??0)>900;
  },null,{timeout:140_000}); reached=true; } catch {}
  if ((await page.locator("#scene").getAttribute("data-air-weapon-launch-log"))?.includes("KSR-5")) {
    try { await page.waitForFunction(()=>{
      const canvas=document.querySelector("#scene");
      return Number(canvas?.dataset.simulationElapsed??0)>500 ||
        (Number(canvas?.dataset.airWeaponsLaunched??0)>0 && Number(canvas?.dataset.airWeaponsActive??0)===0);
    },null,{timeout:45_000}); } catch {}
  }
  const result=await page.locator("#scene").evaluate(canvas=>({elapsed:canvas.dataset.simulationElapsed,objectives:canvas.dataset.scenarioObjectives,launches:canvas.dataset.airWeaponLaunchLog,aircraft:canvas.dataset.airMissionStates,phase:canvas.dataset.spaceWeatherPhase,missionDiagnostics:JSON.parse(canvas.dataset.advancedAirMissionDiagnostics??"[]").filter(aircraft=>aircraft.id.includes("TU-16K")),weaponPhases:canvas.dataset.airWeaponPhases,seekerEvents:canvas.dataset.airSeekerEventLog,hitEvents:canvas.dataset.airWeaponHitLog,samLaunches:canvas.dataset.airDefenseLaunchers,samTargetCategories:canvas.dataset.airDefenseTargetCategories,samTargetNames:canvas.dataset.airDefenseTargetNames,activeWeapons:canvas.dataset.airWeaponsActive}));
  console.log(JSON.stringify({reached,result,errors},null,2));
  const ksrReleased=result.launches?.includes("KSR-5");
  const raidNeutralized=result.objectives?.includes("intercept-badgers:complete");
  if(!reached||errors.length||(!ksrReleased&&!raidNeutralized))process.exitCode=1;
  if(ksrReleased&&result.elapsed>=1080&&(!result.objectives?.includes("intercept-badgers:complete")||!result.objectives?.includes("red-maritime-strike:complete")))process.exitCode=1;
  if(ksrReleased&&(!result.samLaunches?.includes("blue-cg-57")||!result.samTargetCategories?.includes("missile")))process.exitCode=1;
} finally {await browser.close();}
