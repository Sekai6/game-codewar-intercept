import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbAdvancedAirAi").uncheck();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() =>
    Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) > 0,
  );
  await page.waitForTimeout(750);
  const disabled = await page.locator("#scene").evaluate(canvas => ({
    enabled: canvas.dataset.advancedAirAiEnabled,
    updates: Number(canvas.dataset.advancedAirAiUpdates ?? -1),
    missionUpdates: Number(canvas.dataset.advancedAirMissionUpdates ?? -1),
    pilotUpdates: Number(canvas.dataset.advancedAirPilotUpdates ?? -1),
  }));
  await page.locator("#sbAdvancedAirAi").evaluate(input => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() =>
    Number(document.querySelector("#scene")?.dataset.advancedAirAiUpdates ?? 0) > 0,
    null,
    { timeout: 10_000 },
  );
  const enabled = await page.locator("#scene").evaluate(canvas => ({
    enabled: canvas.dataset.advancedAirAiEnabled,
    updates: Number(canvas.dataset.advancedAirAiUpdates ?? 0),
    missionUpdates: Number(canvas.dataset.advancedAirMissionUpdates ?? 0),
    pilotUpdates: Number(canvas.dataset.advancedAirPilotUpdates ?? 0),
    pilotStates: canvas.dataset.advancedAirPilotStates ?? "",
    missionPlans: canvas.dataset.advancedAirMissionPlans ?? "",
    states: canvas.dataset.advancedAirAiStates ?? "",
  }));
  console.log(JSON.stringify({ disabled, enabled, errors }, null, 2));
  if (
    errors.length ||
    disabled.enabled !== "false" ||
    disabled.updates !== 0 ||
    disabled.missionUpdates !== 0 ||
    disabled.pilotUpdates !== 0 ||
    enabled.enabled !== "true" ||
    enabled.updates <= 0 ||
    enabled.missionUpdates <= 0 ||
    enabled.pilotUpdates <= 0 ||
    !enabled.pilotStates.includes("blue-F-14A") ||
    !enabled.missionPlans.includes(":on-station:") ||
    !enabled.states.includes("normal")
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
