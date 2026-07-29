import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  // The damage assertion is specifically for the ship-SAM path.  Pin an
  // actual launcher-owning ship instead of relying on the setup panel's
  // previously selected/default platform.
  const ticonderogaOption = page.locator("#sbShip option[value='ticonderoga']");
  if (await ticonderogaOption.count() === 0) {
    const availableShips = await page.locator("#sbShip option").evaluateAll(options =>
      options.map(option => `${option.value}:${option.textContent?.trim() ?? ""}`));
    throw new Error(`ticonderoga ship option not found; available=${availableShips.join("|")}`);
  }
  await page.locator("#sbShip").selectOption("ticonderoga");
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  try {
    await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airDamageEventLog ?? "").includes("Tu-16K"), null, { timeout: 45_000 });
  } catch (error) {
    const diagnostic = await page.locator("#scene").evaluate(c => ({
      elapsed:c.dataset.simulationElapsed ?? "",
      damageLog:c.dataset.airDamageEventLog ?? "",
      missions:c.dataset.airMissionStates ?? "",
      states:c.dataset.aircraftStates ?? "",
      launchers:c.dataset.airDefenseLaunchers ?? "",
      categories:c.dataset.airDefenseTargetCategories ?? "",
      launchLog:c.dataset.airWeaponLaunchLog ?? "",
      hitLog:c.dataset.airHitEventLog ?? "",
    }));
    console.error("Aircraft SAM damage timeout", JSON.stringify(diagnostic, null, 2));
    throw error;
  }
  const result = await page.locator("#scene").evaluate(c => ({
    damageLog: c.dataset.airDamageEventLog ?? "",
    missions: c.dataset.airMissionStates ?? "",
    states: c.dataset.aircraftStates ?? "",
    launchers: c.dataset.airDefenseLaunchers ?? "",
    categories: c.dataset.airDefenseTargetCategories ?? "",
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || !result.damageLog.includes("Tu-16K") || !result.categories.includes("aircraft") || !/MK 10|MK 41/.test(result.launchers)) process.exitCode = 1;
} finally { await browser.close(); }
