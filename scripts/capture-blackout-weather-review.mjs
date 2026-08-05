import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const output = "reference-output/v121-weather-review";
await mkdir(output, { recursive:true });
const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:[
    "--enable-unsafe-webgpu",
    "--enable-features=WebGPUDeveloperFeatures",
    "--renderer-process-limit=1",
    "--disable-background-networking",
    "--disable-renderer-backgrounding",
  ],
});
const page = await browser.newPage({ viewport:{ width:2560, height:1440 }, deviceScaleFactor:1 });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

const stages = [
  { name:"01-quiet", offset:20, view:null },
  { name:"02-warning", offset:150, view:"8" },
  { name:"03-total-blackout", offset:300, view:"9" },
  { name:"04-intermittent-window", offset:750, view:"8" },
  { name:"05-recovery", offset:980, view:null },
];
const diagnostics = [];
try {
  for (const stage of stages) {
    await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationScenarioOffset=${stage.offset}`, { waitUntil:"domcontentloaded", timeout:15_000 });
    await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
    await page.locator("#sbHighQualityEnvironment").check();
    const ultra = page.locator("#sbWebGpuUltra");
    if (await ultra.isEnabled()) await ultra.check();
    await page.locator("#sbStart").click();
    await page.locator(".scenario-briefing [data-begin]").click();
    await page.waitForFunction(offset => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= offset, stage.offset, { timeout:25_000 });
    if (stage.view) await page.keyboard.press(stage.view);
    await page.waitForTimeout(1800);
    const state = await page.locator("#scene").evaluate(canvas => ({
      elapsed:canvas.dataset.simulationElapsed,
      phase:canvas.dataset.spaceWeatherPhase,
      intensity:canvas.dataset.spaceWeatherIntensity,
      timeOfDay:canvas.dataset.environmentTimeOfDay,
      sunAltitude:canvas.dataset.environmentSunAltitudeDeg,
      highQuality:canvas.dataset.highQualityEnvironment,
      auroraControlled:canvas.dataset.auroraEnvironmentControlled,
      cameraMode:canvas.dataset.cameraViewMode,
      webGpuUltra:canvas.dataset.webGpuUltraStatus,
      webGpuBackend:canvas.dataset.webGpuUltraBackend,
      webGpuAdapter:canvas.dataset.webGpuUltraAdapter,
      webGpuError:canvas.dataset.webGpuUltraError,
      auroraActive:canvas.dataset.auroraEnvironment,
      auroraIntensity:canvas.dataset.auroraIntensity,
      localWeather:canvas.dataset.localWeather,
    }));
    diagnostics.push({ stage:stage.name, ...state });
    await page.screenshot({ path:`${output}/${stage.name}.png`, fullPage:true });
  }
  console.log(JSON.stringify({ output, diagnostics, errors }, null, 2));
  if (errors.length) process.exitCode=1;
} finally {
  await browser.close();
}
