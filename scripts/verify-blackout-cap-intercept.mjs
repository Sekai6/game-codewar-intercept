import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

const sample = async elapsed => {
  await page.waitForFunction(target =>
    Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= target,
  elapsed, { timeout: 45_000 });
  return page.locator("#scene").evaluate(canvas => ({
    elapsed: Number(canvas.dataset.simulationElapsed ?? 0),
    roles: canvas.dataset.advancedAirFormationRoles ?? "",
    contacts: canvas.dataset.advancedAirPerceivedContacts ?? "",
    missions: canvas.dataset.advancedAirMissionPlans ?? "",
    tactical: canvas.dataset.advancedAirTacticalStates ?? "",
    launchZones: canvas.dataset.advancedAirLaunchZones ?? "",
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
    assignments: canvas.dataset.airWeaponLaunchAssignments ?? "",
    seeker: canvas.dataset.airSeekerEventLog ?? "",
    hits: canvas.dataset.airWeaponHitLog ?? "",
  }));
};

try {
  await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationTimeScale=8`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  const samples = [];
  for (const time of [80, 140, 200, 235]) samples.push(await sample(time));
  const allRecords = key => [...new Set(samples.flatMap(sample =>
    (sample[key] ?? "").split("|").filter(Boolean)))];
  const phoenixLaunches = allRecords("launches")
    .filter(record => record.includes("AIM-54A Phoenix"));
  const phoenixAssignments = allRecords("assignments")
    .filter(record => record.includes(":AIM-54A:"));
  const f14Roles = allRecords("roles")
    .filter(record => record.startsWith("blue-F-14A-"));
  const f14Contacts = allRecords("contacts")
    .filter(record => record.startsWith("blue-F-14A-"));
  const phoenixShooters = new Set(phoenixAssignments.map(record => record.split(":")[1]));
  const phoenixTargets = new Set(phoenixAssignments.map(record => record.split(":")[3]));
  const longRangeShot = phoenixLaunches.some(record => {
    const range = /RANGE ([\d.]+) KM/.exec(record);
    return Number(range?.[1] ?? 0) >= 70;
  });
  const f14WithWeaponContacts = new Set(f14Contacts
    .filter(record => record.includes(":aircraft:") && record.endsWith(":weapon"))
    .map(record => record.split(":")[0]));
  const f14TacticalParticipants = new Set(f14Roles
    .filter(record => record.includes(":shooter:") || record.includes(":supporter:"))
    .map(record => record.split(":")[0]));
  const cueOnlyAew = allRecords("seeker").some(record =>
    record.includes("F-14A Tomcat AEW COMMAND RECEIVED") &&
    record.includes("CUE ONLY / NO WEAPON AUTHORITY"));
  console.log(JSON.stringify({
    samples,
    phoenixLaunches,
    phoenixAssignments,
    phoenixShooters: [...phoenixShooters],
    phoenixTargets: [...phoenixTargets],
    f14Roles,
    f14Contacts,
    f14WithWeaponContacts: [...f14WithWeaponContacts],
    f14TacticalParticipants: [...f14TacticalParticipants],
    cueOnlyAew,
    longRangeShot,
    errors,
  }, null, 2));
  if (errors.length || phoenixLaunches.length < 2 ||
      phoenixShooters.size < 2 || phoenixTargets.size < 2 ||
      f14TacticalParticipants.size < 2 ||
      f14WithWeaponContacts.size < 2 || !cueOnlyAew || !longRangeShot)
    process.exitCode = 1;
} finally {
  await browser.close();
}
