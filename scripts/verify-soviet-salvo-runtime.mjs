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
const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}shortAirValidation=1&sovietSalvoValidation=1`;

async function start(enabled) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbSovietCommandEra").selectOption("ntu-1980s");
  // This focused raid fixture keeps the complete defense runtime active with an
  // explicitly empty SAM magazine, so launch authorization and damage are not bypassed.
  await page.locator("#sbRim").fill("0");
  await page.locator("#sbSm2").fill("0");
  await page.locator("#sbSm2er").fill("0");
  const toggle = page.locator("#sbSovietCommand");
  if (enabled) await toggle.check(); else await toggle.uncheck();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
}

try {
  await start(true);
  await page.waitForFunction(() =>
    Number(document.querySelector("#scene")?.dataset.sovietSalvoAssignments ?? 0) >= 2,
  null, { timeout: 35_000 });
  let twoReleasesObserved = true;
  try {
    await page.waitForFunction(() =>
      ((document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").match(/KSR-5/g) ?? []).length >= 2,
    null, { timeout: 40_000 });
  } catch {
    twoReleasesObserved = false;
  }
  const active = await page.locator("#scene").evaluate((scene) => ({
    waves: Number(scene.dataset.sovietSalvoWavesPlanned ?? 0),
    assignments: Number(scene.dataset.sovietSalvoAssignments ?? 0),
    spread: Number(scene.dataset.sovietSalvoArrivalSpread ?? Infinity),
    plans: scene.dataset.sovietSalvoPlanStates ?? "",
    events: scene.dataset.sovietSalvoEventLog ?? "",
    launches: scene.dataset.airWeaponLaunchLog ?? "",
    hardpoints: scene.dataset.airHardpointStates ?? "",
    aircraft: scene.dataset.aircraftStates ?? "",
  }));
  const events = active.events.split("|");
  const areaIndex = events.findIndex((event) => event.includes("TARGET AREA RECEIVED"));
  const orderIndex = events.findIndex((event) => event.includes("FLEET STRIKE ORDER"));
  const assignments = events.filter((event) => event.includes("SALVO ASSIGNMENT"));
  const launches = events.filter((event) => event.includes("LAUNCH KSR-5"));
  const assignedReleaseTimes = new Map(assignments.map((event) => {
    const aircraft = event.match(/red-TU-16K-\d+/)?.[0];
    const release = Number(event.match(/RELEASE ([\d.]+)/)?.[1]);
    return [aircraft, release];
  }));
  const legalLaunchTimes = launches.every((event) => {
    const aircraft = event.match(/red-TU-16K-\d+/)?.[0];
    const launchedAt = Number(event.split(":")[0]);
    return aircraft && launchedAt + 0.01 >= (assignedReleaseTimes.get(aircraft) ?? Infinity);
  });

  await start(false);
  await page.waitForTimeout(5000);
  const disabled = await page.locator("#scene").evaluate((scene) => ({
    waves: Number(scene.dataset.sovietSalvoWavesPlanned ?? 0),
    assignments: Number(scene.dataset.sovietSalvoAssignments ?? 0),
    events: scene.dataset.sovietSalvoEventLog ?? "",
  }));
  const result = { active, disabled, ordering: { areaIndex, orderIndex, assignments: assignments.length, launches: launches.length, legalLaunchTimes, twoReleasesObserved }, errors };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length || active.waves !== 1 || active.assignments !== 2 || active.spread > 0.15 ||
    areaIndex < 0 || orderIndex <= areaIndex || assignments.length !== 2 || !twoReleasesObserved || launches.length < 2 || !legalLaunchTimes ||
    active.events.includes("blue-surface-ship") ||
    (active.hardpoints.match(/centerline-ksr:empty:none/g) ?? []).length < 2 ||
    disabled.waves !== 0 || disabled.assignments !== 0 || disabled.events.includes("SALVO ASSIGNMENT")
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
