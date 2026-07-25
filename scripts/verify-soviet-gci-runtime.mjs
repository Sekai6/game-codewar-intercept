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
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function start(enabled) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("fighter");
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
    return Number(data?.gciDelivered ?? 0) > 0 && (data?.gciRadarStates ?? "").includes("standby");
  }, null, { timeout: 20_000 });
  const guided = await page.locator("#scene").evaluate((scene) => ({
    era: scene.dataset.sovietCommandEra,
    operational: scene.dataset.gciOperational,
    delivered: Number(scene.dataset.gciDelivered ?? 0),
    active: Number(scene.dataset.gciActiveCommands ?? 0),
    delay: Number(scene.dataset.gciMeanDelay ?? 0),
    commands: scene.dataset.gciCommandStates ?? "",
    radar: scene.dataset.gciRadarStates ?? "",
    localTracks: scene.dataset.gciAirLocalTracks ?? "",
  }));
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("R-27R"), null, { timeout: 35_000 });
  guided.events = await page.locator("#scene").evaluate((scene) => scene.dataset.gciEventLog ?? "");
  const commandAt = Number(guided.events.split("|").find((event) => event.includes("GCI COMMAND"))?.split(":")[0] ?? Infinity);
  const detectAt = Number(guided.events.split("|").find((event) => event.includes(" DETECT"))?.split(":")[0] ?? Infinity);
  const launchAt = Number(guided.events.split("|").find((event) => event.includes(" LAUNCH"))?.split(":")[0] ?? Infinity);

  await start(false);
  await page.waitForTimeout(3500);
  const disabled = await page.locator("#scene").evaluate((scene) => ({
    operational: scene.dataset.gciOperational,
    delivered: Number(scene.dataset.gciDelivered ?? 0),
    active: Number(scene.dataset.gciActiveCommands ?? 0),
    commands: scene.dataset.gciCommandStates ?? "",
  }));
  const result = { guided, disabled, ordering: { commandAt, detectAt, launchAt }, errors };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length || guided.era !== "ntu-1980s" || guided.operational !== "true" ||
    guided.delivered <= 0 || guided.active <= 0 || guided.delay <= 0 ||
    !guided.commands.includes("GCI-") || guided.commands.includes("blue-F-14A") ||
    !guided.radar.includes("standby") || !guided.localTracks.split("|").some((state) => state.endsWith(":0")) ||
    !(commandAt < detectAt && detectAt <= launchAt) ||
    disabled.operational !== "false" || disabled.delivered !== 0 || disabled.active !== 0 ||
    !disabled.commands.split("|").every((state) => state.endsWith(":none"))
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
