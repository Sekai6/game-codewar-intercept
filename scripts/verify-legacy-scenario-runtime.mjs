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
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil:"domcontentloaded", timeout:15_000 });
  const initial = await page.locator("#sbScenario").inputValue();
  await page.locator("#sbScenario").selectOption("legacy-surface-defense");
  const configured = {
    count:await page.locator("#sbCount").inputValue(),
    platform:await page.locator("#sbPlatform").inputValue(),
    air:await page.locator("#sbAirCombat").isChecked(),
  };
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) > .2, null, { timeout:12_000 });
  const result=await page.locator("#scene").evaluate(canvas=>({
    scenarioId:canvas.dataset.scenarioId,
    schema:canvas.dataset.scenarioSchemaVersion,
    phase:canvas.dataset.scenarioPhase,
    selectedThreat:canvas.dataset.selectedThreatKind,
    fleetShips:canvas.dataset.fleetShips,
  }));
  const feed=await page.locator("#feed").innerText();
  console.log(JSON.stringify({initial,configured,result,feed:feed.slice(0,500),errors},null,2));
  if(errors.length || initial!=="sandbox-custom" || configured.count!=="3" || configured.platform!=="AIRBORNE" || configured.air
    || result.scenarioId!=="legacy-surface-defense" || result.schema!=="1" || !result.fleetShips?.includes("blue-long-beach")
    || result.selectedThreat!=="P-500" || result.phase!=="quiet") process.exitCode=1;
} finally { await browser.close(); }
