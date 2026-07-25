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
  await page.waitForFunction(() =>
    (document.querySelector("#scene")?.dataset.advancedAirStoreStates ?? "")
      .includes("blue-F-14A-1:"), null, { timeout: 10_000 });
  const initialStores = await page.locator("#scene").evaluate(canvas =>
    canvas.dataset.advancedAirStoreStates ?? "");
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return (canvas?.dataset.airWeaponLaunchLog ?? "").includes("AIM-54A Phoenix") &&
      (canvas?.dataset.advancedAirLaunchZones ?? "").length > 0;
  }, null, { timeout: 35_000 });
  await page.waitForFunction(() => {
    const records = (document.querySelector("#scene")?.dataset.airWeaponKinematics ?? "")
      .split("|").filter(record => record.includes(":AIM-54A:"));
    return records.some(record => Number(record.split(":")[5]) >= 100);
  }, null, { timeout: 15_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    maneuvers: canvas.dataset.advancedAirManeuverLog ?? "",
    states: canvas.dataset.advancedAirTacticalStates ?? "",
    launchZones: canvas.dataset.advancedAirLaunchZones ?? "",
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
    kinematics: canvas.dataset.airWeaponKinematics ?? "",
    stores: canvas.dataset.advancedAirStoreStates ?? "",
  }));
  const parseStores = value => new Map(value.split("|").filter(Boolean).map(record => {
    const [id, mass, ratio, stall, thrust, parasite, induced] = record.split(":");
    return [id, { mass:Number(mass), ratio:Number(ratio), stall:Number(stall),
      thrust:Number(thrust), parasite:Number(parasite), induced:Number(induced) }];
  }));
  const before = parseStores(initialStores);
  const after = parseStores(result.stores);
  const releasedAircraft = [...new Set(result.launches.split("|")
    .filter(launch => launch.includes("AIM-54A Phoenix"))
    .map(launch => launch.match(/AIRFRAME ([^ /]+)/)?.[1]).filter(Boolean))];
  const storeReleaseValid = releasedAircraft.length > 0 &&
    releasedAircraft.every(id => {
      const initial = before.get(id), current = after.get(id);
      return initial && current && current.mass < initial.mass &&
        current.ratio < initial.ratio && current.stall < initial.stall;
    });
  console.log(JSON.stringify({ ...result, initialStores, releasedAircraft,
    storeReleaseValid, errors }, null, 2));
  const zoneValid = result.launchZones.split("|").filter(Boolean).every(record => {
    const [, range, rMin, rNe, rTr, rMax] = record.split(":");
    return Number(rMin) < Number(rNe) && Number(rNe) < Number(rTr) &&
      Number(rTr) < Number(rMax) && Number(range) >= Number(rMin);
  });
  const phoenixLaunchRanges = result.launches.split("|").filter(line => line.includes("AIM-54A Phoenix"))
    .map(line => Number(line.match(/RANGE ([\d.]+) KM/)?.[1] ?? 0));
  const phoenixKinematics = result.kinematics.split("|").filter(record => record.includes(":AIM-54A:"));
  const phoenixLoftValid = phoenixKinematics.some(record => Number(record.split(":")[5]) >= 100);
  if (
    errors.length ||
    !result.maneuvers.includes("BVR CRANK") ||
    !result.launchZones ||
    !zoneValid ||
    !storeReleaseValid ||
    !phoenixLaunchRanges.some(range => range >= 70) ||
    !phoenixLoftValid ||
    !result.launches.includes("AIM-54A Phoenix")
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
