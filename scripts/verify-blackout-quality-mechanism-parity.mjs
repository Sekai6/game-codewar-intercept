import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});

const run = async (highQuality) => {
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
  const errors=[];
  page.on("console", message => { if (message.type()==="error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationTimeScale=8&validationScenarioOffset=295`, { waitUntil:"domcontentloaded", timeout:15_000 });
    const quality = page.locator("#sbHighQualityEnvironment");
    if (highQuality) await quality.check(); else await quality.uncheck();
    await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
    await page.locator("#sbStart").click();
    await page.locator(".scenario-briefing [data-begin]").click();
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 305, null, { timeout:20_000 });
    const result = await page.locator("#scene").evaluate(canvas => ({
      phase:canvas.dataset.spaceWeatherPhase,
      intensity:canvas.dataset.spaceWeatherIntensity,
      commsWindow:canvas.dataset.spaceWeatherCommsWindow,
      spatial:(canvas.dataset.spaceWeatherSpatialStates ?? "").split("|").map(value => value.split(":").slice(0,2).join(":")),
      localPlatforms:(canvas.dataset.localWeatherStates ?? "").split("|").filter(Boolean).map(value => value.split(":")[0]).sort(),
      lost:(canvas.dataset.lostCommsStates ?? "").split("|").map(value => value.split(":").slice(0,2).join(":")),
      environmentHighQuality:canvas.dataset.highQualityEnvironment,
    }));
    assert.deepEqual(errors, [], `${highQuality ? "high" : "low"} quality emitted browser errors`);
    return result;
  } finally { await page.close(); }
};

try {
  // Pages are created and closed sequentially: only one renderer is active.
  const low = await run(false);
  const high = await run(true);
  assert.equal(low.phase, "total-blackout");
  assert.equal(high.phase, low.phase, "quality setting must not change weather phase");
  assert(Math.abs(Number(high.intensity) - Number(low.intensity)) <= 0.002,
    "quality setting must not change space-weather intensity beyond one simulation-tick interpolation tolerance");
  assert.equal(high.commsWindow, low.commsWindow, "quality setting must not change communication windows");
  assert.deepEqual(high.spatial, low.spatial, "quality setting must not change propagation-zone membership");
  assert.deepEqual(high.localPlatforms, low.localPlatforms, "quality setting must not change local weather participants");
  assert.deepEqual(high.lost, low.lost, "quality setting must not change lost-comms doctrine transitions");
  console.log(JSON.stringify({ low, high }, null, 2));
} finally { await browser.close(); }
