import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

try {
  const rawUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}shortAirValidation=1`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("joint");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sandbox-panel")).display === "none");
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === 6);
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) > 0);
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  try {
    await page.waitForFunction(() => {
      const scene = document.querySelector("#scene");
      return (scene?.dataset.airReleaseAuthorizationLog ?? "").split("|").filter(Boolean).length >= 3 && (scene?.dataset.airWeaponLaunchLog ?? "").split("|").filter(Boolean).length >= 3;
    }, null, { timeout: 30_000 });
  } catch (error) {
    const diagnostic = await page.locator("#scene").evaluate(scene => ({
      elapsed: scene.dataset.simulationElapsed,
      authorizations: scene.dataset.airReleaseAuthorizationLog,
      launches: scene.dataset.airWeaponLaunchLog,
      hardpoints: scene.dataset.airHardpointStates,
      aircraft: scene.dataset.aircraftStates,
    }));
    console.error("Air hardpoint release timeout", JSON.stringify(diagnostic, null, 2));
    throw error;
  }
  await page.waitForFunction(() => {
    const entries = (document.querySelector("#scene")?.dataset.airWeaponReleaseAges ?? "").split("|").filter(Boolean);
    return entries.length > 0 && entries.every(entry => {
      const [, age, ignitionDelay] = entry.split(":");
      return Number(age) >= Number(ignitionDelay);
    });
  }, null, { timeout: 5_000 });
  const result = await page.locator("#scene").evaluate(scene => ({
    authorizations:(scene.dataset.airReleaseAuthorizationLog ?? "").split("|").filter(Boolean),
    launches:(scene.dataset.airWeaponLaunchLog ?? "").split("|").filter(Boolean),
    hardpoints:(scene.dataset.airHardpointStates ?? "").split("|").filter(Boolean),
    releaseAges:(scene.dataset.airWeaponReleaseAges ?? "").split("|").filter(Boolean),
  }));
  const releasedHardpoints = result.launches.map(launch =>
    launch.split(" / ").find(segment => /^(?:WING|TUNNEL)-/.test(segment)) ?? "",
  );
  const emptyReleasedHardpoints = releasedHardpoints.every(hardpoint => result.hardpoints.some(state => state.includes(`:${hardpoint.toLowerCase()}:empty:none`)));
  const separationCompleted = result.releaseAges.every(entry => { const [,age,ignitionDelay]=entry.split(":"); return Number(age)>=Number(ignitionDelay); });
  const bothWingSidesReleased = releasedHardpoints.some(hardpoint => hardpoint.includes("WING-PORT")) && releasedHardpoints.some(hardpoint => hardpoint.includes("WING-STARBOARD"));
  const platformStationsPresent = result.hardpoints.some(state => state.includes("red-TU-16K") && state.includes(":wing-port-ksr:")) && result.hardpoints.some(state => state.includes("blue-A-6E") && state.includes(":wing-port-strike:"));
  const output={authorizationCount:result.authorizations.length,launchCount:result.launches.length,releasedHardpoints,emptyReleasedHardpoints,separationCompleted,bothWingSidesReleased,platformStationsPresent,errors};
  console.log(JSON.stringify(output,null,2));
  if(errors.length||output.authorizationCount<3||output.launchCount<3||releasedHardpoints.some(hardpoint=>!hardpoint)||!emptyReleasedHardpoints||!separationCompleted||!bothWingSidesReleased||!platformStationsPresent)process.exitCode=1;
} finally { await browser.close(); }
