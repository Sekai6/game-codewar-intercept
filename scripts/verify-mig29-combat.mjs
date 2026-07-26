import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const url = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  url.searchParams.set("shortAirValidation", "1");
  await page.goto(url.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("fighter");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sandbox-panel")).display === "none");
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) > 0);
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  try {
    await page.waitForFunction(
      () => (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("MiG-29A Fulcrum-A LAUNCH"),
      null,
      { timeout: 50_000 },
    );
  } catch (error) {
    const diagnostic = await page.locator("#scene").evaluate((scene) => ({
      elapsed: scene.dataset.simulationElapsed,
      missions: scene.dataset.airMissionStates,
      launches: scene.dataset.airWeaponLaunchLog,
      hardpoints: scene.dataset.airHardpointStates,
      gciEvents: scene.dataset.gciEventLog,
      gciCommands: scene.dataset.gciCommandStates,
      tracks: scene.dataset.gciTrackStates,
      ranges: scene.dataset.aircraftShipRangesKm,
    }));
    console.error("MiG-29 combat timeout", JSON.stringify({ ...diagnostic, errors }, null, 2));
    throw error;
  }
  const result = await page.locator("#scene").evaluate((scene) => ({
    missions: scene.dataset.airMissionStates ?? "",
    launches: scene.dataset.airWeaponLaunchLog ?? "",
    hardpoints: scene.dataset.airHardpointStates ?? "",
    categories: scene.dataset.airDefenseTargetCategories ?? "",
    targetNames: scene.dataset.airDefenseTargetNames ?? "",
    legacyRegistrations: Number(scene.dataset.airDefenseLegacyRegistrations ?? -1),
    legacyFields: Number(scene.dataset.airDefenseLegacyFields ?? -1),
    gciEvents: scene.dataset.gciEventLog ?? "",
  }));
  const gciEvents = result.gciEvents.split("|");
  const gciAt = Number(gciEvents.find((event) => event.includes("GCI COMMAND"))?.split(":")[0] ?? Infinity);
  const detectAt = Number(gciEvents.find((event) => event.includes(" DETECT"))?.split(":")[0] ?? Infinity);
  const launchAt = Number(gciEvents.find((event) => event.includes(" LAUNCH"))?.split(":")[0] ?? Infinity);
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length ||
    !result.missions.includes("red-MIG-29A") ||
    !result.launches.includes("MiG-29A Fulcrum-A") ||
    !/(?:R-27R Alamo-A|R-73 Archer)/.test(result.launches) ||
    !result.hardpoints.includes("red-MIG-29A") ||
    !result.hardpoints.includes(":empty:none") ||
    !(gciAt < detectAt && detectAt <= launchAt) ||
    result.legacyRegistrations !== 0 ||
    result.legacyFields !== 0
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
