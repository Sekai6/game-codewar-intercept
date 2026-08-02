import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/?validationTimeScale=8&validationScenarioOffset=205", { waitUntil:"domcontentloaded", timeout:15_000 });
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.spaceWeatherPhase === "solar-flare", null, { timeout:15_000 });
  const flare = await page.locator("#scene").evaluate(canvas => ({
    elapsed:canvas.dataset.simulationElapsed,
    phase:canvas.dataset.spaceWeatherPhase,
    lost:canvas.dataset.lostCommsStates,
  }));
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.spaceWeatherPhase === "total-blackout", null, { timeout:30_000 });
  const blackout = await page.locator("#scene").evaluate(canvas => ({
    elapsed:canvas.dataset.simulationElapsed,
    phase:canvas.dataset.spaceWeatherPhase,
    lost:canvas.dataset.lostCommsStates,
    aircraft:canvas.dataset.aircraftTotal,
    fleetShips:canvas.dataset.fleetShips,
  }));
  await page.screenshot({ path:"verification-blackout-total-band-denial.png", fullPage:true });
  console.log(JSON.stringify({ flare, blackout, errors }, null, 2));
  if (errors.length || flare.phase !== "solar-flare" || blackout.phase !== "total-blackout"
      || !blackout.lost?.includes(":lost:") || Number(blackout.aircraft) < 1
      || !blackout.fleetShips?.includes("blue-cg-57")) process.exitCode = 1;
} finally { await browser.close(); }
