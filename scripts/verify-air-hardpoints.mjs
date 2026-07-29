import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
// This verifies release ownership and telemetry rather than image quality.
// Stay at the runtime's SSAO cutoff so Linux SwiftShader can advance the
// fixed-step simulation without weakening any hardpoint assertions.
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
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

  const reportFailure = async (failureKind, error) => {
    let diagnostic;
    try {
      diagnostic = await page.locator("#scene").evaluate(scene => ({
        elapsed: scene.dataset.simulationElapsed ?? "",
        authorizations: scene.dataset.airReleaseAuthorizationLog ?? "",
        launches: scene.dataset.airWeaponLaunchLog ?? "",
        hardpoints: scene.dataset.airHardpointStates ?? "",
        releaseAges: scene.dataset.airWeaponReleaseAges ?? "",
        aircraft: scene.dataset.aircraftStates ?? "",
      }));
    } catch (diagnosticError) {
      diagnostic = {
        diagnosticError: diagnosticError instanceof Error
          ? diagnosticError.message
          : String(diagnosticError),
      };
    }
    console.error(`Air hardpoint evidence ${failureKind}`, JSON.stringify({
      ...diagnostic,
      runnerError: error instanceof Error ? error.message : String(error),
      errors,
    }, null, 2));
  };

  let launchEvidence;
  try {
    launchEvidence = await (await page.waitForFunction(() => {
      const scene = document.querySelector("#scene");
      const elapsed = Number(scene?.dataset.simulationElapsed ?? 0);
      const authorizationCount = (scene?.dataset.airReleaseAuthorizationLog ?? "")
        .split("|").filter(Boolean).length;
      const launchCount = (scene?.dataset.airWeaponLaunchLog ?? "")
        .split("|").filter(Boolean).length;
      if (authorizationCount >= 3 && launchCount >= 3) {
        return { status: "ready", elapsed, authorizationCount, launchCount };
      }
      return elapsed >= 25
        ? { status: "simulation-deadline", elapsed, authorizationCount, launchCount }
        : null;
    }, null, { timeout: 120_000 })).jsonValue();
  } catch (error) {
    await reportFailure("launch-watchdog-timeout", error);
    throw error;
  }
  if (launchEvidence?.status !== "ready") {
    const error = new Error(`Hardpoint launch evidence missing at ${launchEvidence?.status ?? "unknown-state"} after ${launchEvidence?.elapsed ?? "unknown"}s`);
    await reportFailure(launchEvidence?.status ?? "unknown-state", error);
    throw error;
  }

  let separationEvidence;
  try {
    separationEvidence = await (await page.waitForFunction(({ simulationDeadline }) => {
      const scene = document.querySelector("#scene");
      const elapsed = Number(scene?.dataset.simulationElapsed ?? 0);
      const entries = (scene?.dataset.airWeaponReleaseAges ?? "").split("|").filter(Boolean);
      const separated = entries.length > 0 && entries.every(entry => {
        const [, age, ignitionDelay] = entry.split(":");
        return Number(age) >= Number(ignitionDelay);
      });
      if (separated) return { status: "ready", elapsed, entries };
      return elapsed >= simulationDeadline
        ? { status: "simulation-deadline", elapsed, entries }
        : null;
    }, { simulationDeadline: launchEvidence.elapsed + 5 }, { timeout: 60_000 })).jsonValue();
  } catch (error) {
    await reportFailure("separation-watchdog-timeout", error);
    throw error;
  }
  if (separationEvidence?.status !== "ready") {
    const error = new Error(`Hardpoint separation evidence missing at ${separationEvidence?.status ?? "unknown-state"} after ${separationEvidence?.elapsed ?? "unknown"}s`);
    await reportFailure(separationEvidence?.status ?? "unknown-state", error);
    throw error;
  }
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
