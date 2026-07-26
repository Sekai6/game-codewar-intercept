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
const rawUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}shortAirValidation=1`;

async function start(enabled) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
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
  try {
    await page.waitForFunction(() =>
      Number(document.querySelector("#scene")?.dataset.sovietFleetCommandDelivered ?? 0) > 0,
    null, { timeout: 30_000 });
  } catch (error) {
    const diagnostics = await page.locator("#scene").evaluate((scene) => ({
      maritimeDelivered: scene.dataset.sovietMaritimeDelivered,
      maritimeCues: scene.dataset.sovietMaritimeCueStates,
      operational: scene.dataset.sovietFleetCommandOperational,
      node: scene.dataset.sovietFleetCommandNode,
      nodeAlive: scene.dataset.sovietFleetCommandNodeAlive,
      transmitted: scene.dataset.sovietFleetCommandTransmitted,
      delivered: scene.dataset.sovietFleetCommandDelivered,
      dropped: scene.dataset.sovietFleetCommandDropped,
      orders: scene.dataset.sovietFleetCommandOrders,
      events: scene.dataset.sovietFleetCommandEventLog,
    }));
    console.error("Fleet-command delivery timeout", JSON.stringify({ diagnostics, errors }, null, 2));
    throw error;
  }
  const beforeLaunch = await page.locator("#scene").evaluate((scene) => ({
    orders: scene.dataset.sovietFleetCommandOrders ?? "",
    launches: scene.dataset.airWeaponLaunchLog ?? "",
  }));
  await page.waitForFunction(() =>
    (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("KSR-5"),
  null, { timeout: 35_000 });
  const guided = await page.locator("#scene").evaluate((scene) => ({
    operational: scene.dataset.sovietFleetCommandOperational,
    node: scene.dataset.sovietFleetCommandNode,
    nodeAlive: scene.dataset.sovietFleetCommandNodeAlive,
    delivered: Number(scene.dataset.sovietFleetCommandDelivered ?? 0),
    active: Number(scene.dataset.sovietFleetCommandActiveOrders ?? 0),
    orders: scene.dataset.sovietFleetCommandOrders ?? "",
    events: scene.dataset.sovietFleetCommandEventLog ?? "",
    hardpoints: scene.dataset.airHardpointStates ?? "",
  }));
  const events = guided.events.split("|");
  const areaIndex = events.findIndex((event) => event.includes("TARGET AREA RECEIVED"));
  const detectIndex = events.findIndex((event) => event.includes(" DETECT / SHIP"));
  const orderIndex = events.findIndex((event) => event.includes("FLEET STRIKE ORDER"));
  const launchIndex = events.findIndex((event) => event.includes(" LAUNCH KSR-5"));
  const launchAt = Number(events[launchIndex]?.split(":")[0] ?? Infinity);
  const orderFields = guided.orders.split(":");
  const windowStart = Number(orderFields[3] ?? Infinity);

  await start(false);
  await page.waitForTimeout(4500);
  const disabled = await page.locator("#scene").evaluate((scene) => ({
    operational: scene.dataset.sovietFleetCommandOperational,
    delivered: Number(scene.dataset.sovietFleetCommandDelivered ?? 0),
    active: Number(scene.dataset.sovietFleetCommandActiveOrders ?? 0),
    orders: scene.dataset.sovietFleetCommandOrders ?? "",
  }));
  const result = { beforeLaunch, guided, disabled, ordering: { areaIndex, detectIndex, orderIndex, launchIndex, launchAt, windowStart }, errors };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length || guided.operational !== "true" || guided.nodeAlive !== "true" ||
    guided.delivered <= 0 || !guided.node?.includes("soviet-fleet-command-post") ||
    guided.orders.includes("blue-surface-ship") || !guided.orders.includes("FLEET-ORDER") ||
    beforeLaunch.launches.includes("KSR-5") ||
    !(areaIndex >= 0 && areaIndex < detectIndex && detectIndex < orderIndex && orderIndex < launchIndex) ||
    launchAt + 0.01 < windowStart ||
    !guided.hardpoints.includes("red-TU-16K") || !guided.hardpoints.includes("wing-port-ksr:empty:none") ||
    disabled.operational !== "false" || disabled.delivered !== 0 || disabled.active !== 0 ||
    !disabled.orders.split("|").every((state) => state.endsWith(":none"))
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
