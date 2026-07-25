import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
const rawBaseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const baseUrl = `${rawBaseUrl}${rawBaseUrl.includes("?") ? "&" : "?"}shortAirValidation=1`;

async function start(enabled) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbSovietCommandEra").selectOption("ntu-1980s");
  const toggle = page.locator("#sbSovietCommand");
  if (enabled) await toggle.check(); else await toggle.uncheck();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
}

try {
  await start(true);
  await page.waitForFunction(() => {
    const data = document.querySelector("#scene")?.dataset;
    return Number(data?.sovietMaritimeDelivered ?? 0) > 0;
  }, null, { timeout: 25_000 });
  try {
    await page.waitForFunction(() =>
      (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("KSR-5"),
    null, { timeout: 40_000 });
  } catch (error) {
    const diagnostics = await page.locator("#scene").evaluate((scene) => ({
      cues: scene.dataset.sovietMaritimeCueStates,
      radar: scene.dataset.sovietMaritimeRadarStates,
      events: scene.dataset.sovietMaritimeEventLog,
      tracks: scene.dataset.airTrackStates,
      states: scene.dataset.airMissionStates,
      ranges: scene.dataset.aircraftShipRangesKm,
      launches: scene.dataset.airWeaponLaunchLog,
    }));
    console.error(JSON.stringify({ timeout: diagnostics }, null, 2));
    throw error;
  }
  const guided = await page.locator("#scene").evaluate((scene) => ({
    operational: scene.dataset.sovietMaritimeOperational,
    source: scene.dataset.sovietMaritimeSource,
    delivered: Number(scene.dataset.sovietMaritimeDelivered ?? 0),
    active: Number(scene.dataset.sovietMaritimeActiveCues ?? 0),
    cues: scene.dataset.sovietMaritimeCueStates ?? "",
    radar: scene.dataset.sovietMaritimeRadarStates ?? "",
    emcon: scene.dataset.sovietMaritimeEmconObserved ?? "",
    events: scene.dataset.sovietMaritimeEventLog ?? "",
    hardpoints: scene.dataset.airHardpointStates ?? "",
  }));
  const events = guided.events.split("|");
  const cueIndex = events.findIndex((event) => event.includes("TARGET AREA RECEIVED"));
  const detectIndex = events.findIndex((event) => event.includes(" DETECT"));
  const launchIndex = events.findIndex((event) => event.includes(" LAUNCH KSR-5"));
  const cueAt = Number(events[cueIndex]?.split(":")[0] ?? Infinity);
  const detectAt = Number(events[detectIndex]?.split(":")[0] ?? Infinity);
  const launchAt = Number(events[launchIndex]?.split(":")[0] ?? Infinity);

  await start(false);
  await page.waitForTimeout(3500);
  const disabled = await page.locator("#scene").evaluate((scene) => ({
    operational: scene.dataset.sovietMaritimeOperational,
    delivered: Number(scene.dataset.sovietMaritimeDelivered ?? 0),
    active: Number(scene.dataset.sovietMaritimeActiveCues ?? 0),
    cues: scene.dataset.sovietMaritimeCueStates ?? "",
  }));
  const result = { guided, disabled, ordering: { cueAt, detectAt, launchAt, cueIndex, detectIndex, launchIndex }, errors };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length || guided.operational !== "true" || guided.delivered <= 0 ||
    !guided.cues.match(/:(?:legenda|uspekh-u):(?!.*blue-surface-ship)/) ||
    !guided.emcon.includes("red-TU-16K") ||
    !(cueIndex >= 0 && cueIndex < detectIndex && detectIndex < launchIndex && cueAt <= detectAt && detectAt <= launchAt) ||
    !guided.hardpoints.includes("red-TU-16K") || !guided.hardpoints.includes("centerline-ksr:empty:none") ||
    disabled.operational !== "false" || disabled.delivered !== 0 || disabled.active !== 0 ||
    !disabled.cues.split("|").every((state) => state.endsWith(":none"))
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
