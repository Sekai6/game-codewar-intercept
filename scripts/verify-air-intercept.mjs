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
  const url = new URL(baseUrl);
  url.searchParams.set("airCountermeasures", "off");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  let seekerObserved = true, hitObserved = true;
  try {
    await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airSeekerEventLog ?? "").includes("AIM-54A Phoenix SEEKER ACQUIRED"), null, { timeout: 105_000 });
  } catch { seekerObserved = false; }
  if (seekerObserved) {
    try {
      await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airWeaponHitLog ?? "").includes("AIM-54A Phoenix HIT"), null, { timeout: 45_000 });
    } catch { hitObserved = false; }
  } else hitObserved = false;
  const result = await page.locator("#scene").evaluate(c => ({ seekerLog:c.dataset.airSeekerEventLog??"", hitLog:c.dataset.airWeaponHitLog??"", launchLog:c.dataset.airWeaponLaunchLog??"", kinematics:c.dataset.airWeaponKinematics??"", states:c.dataset.aircraftStates??"", countermeasureEvents:c.dataset.airCountermeasureEventLog??"" }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  const phoenixLaunchRanges = result.launchLog.split("|")
    .filter(line => line.includes("AIM-54A Phoenix"))
    .map(line => Number(line.match(/RANGE ([\d.]+) KM/)?.[1] ?? 0));
  const activePhoenixSettled = result.kinematics.split("|").some(record =>
    record.includes(":AIM-54A:destroyed:") && record.endsWith(":ACTIVE"));
  const targetReactedToHit = /red-TU-16K-\d+:(egress|disabled|crashed):/.test(result.states);
  if (!seekerObserved || !hitObserved || !result.seekerLog.includes("AIM-54A Phoenix SEEKER ACQUIRED") || !result.hitLog.includes("AIM-54A Phoenix HIT") || !phoenixLaunchRanges.some(range => range >= 70) || !activePhoenixSettled || !targetReactedToHit || result.countermeasureEvents.length || result.errors.length) process.exitCode = 1;
} finally { await browser.close(); }
