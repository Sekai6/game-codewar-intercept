import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil:"domcontentloaded", timeout:15_000 });
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  try {
    await page.locator(".scenario-briefing").waitFor({ state:"visible", timeout:8_000 });
  } catch (error) {
    console.error(JSON.stringify({
      selected:await page.locator("#sbScenario").inputValue(),
      guidanceRoots:await page.locator(".scenario-guidance-root").count(),
      scenarioId:await page.locator("#scene").getAttribute("data-scenario-id"),
      errors,
    }, null, 2));
    throw error;
  }
  const briefing = await page.locator(".scenario-briefing").innerText();
  await page.locator(".scenario-briefing [data-begin]").click();
  let advanced = true;
  try {
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) > .5, null, { timeout:12_000 });
  } catch { advanced = false; }
  const result = await page.locator("#scene").evaluate(canvas => ({
    scenarioId: canvas.dataset.scenarioId,
    schema: canvas.dataset.scenarioSchemaVersion,
    phase: canvas.dataset.spaceWeatherPhase,
    auroraControlled: canvas.dataset.auroraEnvironmentControlled,
    fleetShips: canvas.dataset.fleetShips,
    aircraft: canvas.dataset.aircraftTotal,
    elapsed: canvas.dataset.simulationElapsed,
  }));
  await page.screenshot({ path:"verification-blackout-scenario.png", fullPage:true });
  console.log(JSON.stringify({ briefing:briefing.slice(0,240), advanced, result, errors }, null, 2));
  if (!advanced || errors.length || result.scenarioId !== "full-spectrum-blackout" || result.schema !== "1"
      || result.phase !== "quiet" || result.auroraControlled !== "true"
      || !result.fleetShips?.includes("blue-cg-57") || !Number.isFinite(Number(result.aircraft)) || Number(result.aircraft) < 10)
    process.exitCode = 1;
} finally { await browser.close(); }
