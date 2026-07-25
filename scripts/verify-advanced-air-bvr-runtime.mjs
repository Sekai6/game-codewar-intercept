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
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return (canvas?.dataset.airWeaponLaunchLog ?? "").includes("AIM-54A Phoenix") &&
      (canvas?.dataset.advancedAirLaunchZones ?? "").length > 0;
  }, null, { timeout: 35_000 });
  await page.waitForTimeout(4_000);
  const result = await page.locator("#scene").evaluate(canvas => ({
    maneuvers: canvas.dataset.advancedAirManeuverLog ?? "",
    states: canvas.dataset.advancedAirTacticalStates ?? "",
    launchZones: canvas.dataset.advancedAirLaunchZones ?? "",
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
  }));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  const zoneValid = result.launchZones.split("|").filter(Boolean).every(record => {
    const [, range, rMin, rNe, rTr, rMax] = record.split(":");
    return Number(rMin) < Number(rNe) && Number(rNe) < Number(rTr) &&
      Number(rTr) < Number(rMax) && Number(range) >= Number(rMin);
  });
  if (
    errors.length ||
    !result.maneuvers.includes("BVR CRANK") ||
    !result.launchZones ||
    !zoneValid ||
    !result.launches.includes("AIM-54A Phoenix")
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
