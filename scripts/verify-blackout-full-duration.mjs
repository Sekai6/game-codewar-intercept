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
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/?validationTimeScale=16", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  let reached = false;
  try {
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#scene");
      return canvas?.dataset.scenarioEnded === "true" ||
        Number(canvas?.dataset.simulationElapsed ?? 0) >= 1080;
    }, null, { timeout: 210_000 });
    reached = true;
  } catch {}
  const result = await page.locator("#scene").evaluate(canvas => ({
    elapsed: Number(canvas.dataset.simulationElapsed ?? 0),
    ended: canvas.dataset.scenarioEnded,
    phase: canvas.dataset.spaceWeatherPhase,
    objectives: canvas.dataset.scenarioObjectives,
    lostComms: canvas.dataset.lostCommsStates,
    fleetComms: canvas.dataset.fleetCommsDoctrine,
    fleetTracks: canvas.dataset.fleetNetworkTracks,
    events: canvas.dataset.scenarioAarEvents ?? "",
    fleetNetworkEvents: canvas.dataset.fleetNetworkAarEvents ?? "",
    fleetLink11Delivered: Number(canvas.dataset.fleetLink11Delivered ?? 0),
    decisions: Number(canvas.dataset.aarDecisionAuditCount ?? 0),
    aarAircraft: Number(canvas.dataset.aarAircraftCount ?? 0),
    aarAirWeapons: Number(canvas.dataset.aarAirWeaponCount ?? 0),
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
    commandMessages: canvas.dataset.scenarioCommandMessages ?? "",
    requestedRate: Number(canvas.dataset.requestedSimulationRate ?? 0),
    actualRate: Number(canvas.dataset.actualSimulationRate ?? 0),
    shipLaunches: canvas.dataset.airDefenseLaunchers ?? "",
  }));
  console.log(JSON.stringify({ reached, result, errors }, null, 2));
  const event = result.events;
  const recoveryDeliveries = result.fleetNetworkEvents.split("|").filter(entry => {
    const time = Number(entry.split(":", 1)[0]);
    return time >= 960 && entry.includes("FLEET LINK11 DELIVER");
  });
  if (!reached || errors.length || result.ended !== "true" || result.phase !== "recovery" ||
      result.elapsed < 1080 || result.objectives.includes(":active") ||
      !result.objectives.includes("observe-network-collapse:complete") ||
      result.fleetLink11Delivered < 1 ||
      !result.commandMessages.includes("window-cg57-defense-report") ||
      !result.commandMessages.includes("window-e2c-main-raid-track") ||
      !result.commandMessages.includes("window-slava-track") ||
      !result.launches.includes("KSR-5") || !result.launches.includes("AGM-84A") ||
      !result.shipLaunches.includes("blue-cg-57") || !result.shipLaunches.includes("blue-long-beach") ||
      result.decisions < 10 ||
      result.aarAircraft < 10 || result.aarAirWeapons < 1) process.exitCode = 1;
} finally {
  await browser.close();
}
