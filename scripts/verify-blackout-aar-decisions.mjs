import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
const errors=[];
page.on("console", message => { if (message.type()==="error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/?validationTimeScale=8&validationScenarioOffset=295", { waitUntil:"domcontentloaded", timeout:15_000 });
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 320, null, { timeout:25_000 });
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aarDecisionAuditCount ?? 0) >= 12, null, { timeout:10_000 });
  const result=await page.locator("#scene").evaluate(canvas=>({
    elapsed:canvas.dataset.simulationElapsed,
    phase:canvas.dataset.spaceWeatherPhase,
    count:Number(canvas.dataset.aarDecisionAuditCount??0),
    audits:canvas.dataset.aarDecisionAudits??"",
    objectives:canvas.dataset.scenarioObjectives??"",
  }));
  console.log(JSON.stringify({result,errors},null,2));
  const audits = result.audits.split("|");
  const cg57 = audits.find(audit => audit.startsWith("blue-cg-57:")) ?? "";
  const longBeach = audits.find(audit => audit.startsWith("blue-long-beach:")) ?? "";
  const tu16 = audits.find(audit => audit.startsWith("red-TU-16K-")) ?? "";
  if(errors.length||result.phase!=="total-blackout"||result.count<12
    ||!cg57.includes(":lost:weapons-hold:local-radar:")
    ||!cg57.includes(":cue:lost-comms local-defense; best local-radar track is cue-only or below organic fire-control quality")
    ||!longBeach.includes(":lost:weapons-hold:")
    ||!longBeach.includes(":cue:lost-comms hold-command;")
    ||!tu16.includes(":weapon:")
    ||!tu16.includes("weapon-quality track exists but no target satisfies current employment criteria")
    ||!result.objectives.includes(":active")) process.exitCode=1;
} finally { await browser.close(); }
