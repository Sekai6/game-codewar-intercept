import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  const url = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  url.searchParams.set("bfmValidation", "1");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("fighter");
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() =>
    (document.querySelector("#scene")?.dataset.advancedAirTacticalStates ?? "")
      .includes(":bfm-"), null, { timeout: 20_000 });
  await page.waitForTimeout(5_000);
  const result = await page.locator("#scene").evaluate(scene => ({
    tactical: scene.dataset.advancedAirTacticalStates ?? "",
    launches: scene.dataset.airWeaponLaunchLog ?? "",
    threats: scene.dataset.advancedAirThreatStates ?? "",
    pilot: scene.dataset.advancedAirPilotStates ?? "",
    missions: scene.dataset.advancedAirMissionPlans ?? "",
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  const bfmStates = result.tactical.split("|").filter(state => state.includes(":bfm-"));
  const maximumShotWindow = Math.max(0, ...result.tactical.split("|")
    .map(state => Number(state.split(":").at(-1) ?? 0)));
  if (errors.length || bfmStates.length === 0 || !result.pilot ||
      !result.missions || maximumShotWindow > 20)
    process.exitCode = 1;
} finally {
  await browser.close();
}
