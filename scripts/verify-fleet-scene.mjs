import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
try {
  const rawUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}shortAirValidation=1`;
  await page.goto(url, {
    waitUntil: "domcontentloaded", timeout: 15_000,
  });
  const defaultCount = await page.locator("#scene").evaluate((canvas) => Number(canvas.dataset.fleetShipCount ?? 0));
  await page.locator("#sbFleetMode").check();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.fleetShips?.split("|").length ?? 0) === 2);
  await page.locator("#sbFleetMode").uncheck();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.fleetShipCount ?? -1) === 0);
  const disabledCount = await page.locator("#scene").evaluate((canvas) => Number(canvas.dataset.fleetShipCount));
  await page.locator("#sbFleetMode").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return Number(canvas?.dataset.fleetShipCount ?? 0) === 2
      && (canvas?.dataset.fleetStationStates ?? "").includes("blue-cg-57:")
      && canvas?.dataset.fleetLink11Ncs === "blue-cgn-9"
      && Number(canvas?.dataset.fleetLink11RollCalls ?? 0) > 0
      && Number(canvas?.dataset.fleetLink11Delivered ?? 0) > 0
      && Number(canvas?.dataset.fleetPictureTracks ?? 0) > 0
      && (canvas?.dataset.fleetNetworkTracks ?? "").split("|")
        .some((entry) => Number(entry.split(":")[1] ?? 0) > 0)
      && canvas?.dataset.fleetLink11WeaponAuthority === "false";
  }, null, { timeout: 20_000 });
  try {
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#scene");
      return (canvas?.dataset.fleetLocalWeaponTracks ?? "").split("|")
        .some((entry) => Number(entry.split(":")[1] ?? 0) > 0)
        && (canvas?.dataset.fleetAawAssignments ?? "").includes("AAW-");
    }, null, { timeout: 45_000 });
  } catch (error) {
    const diagnostic = await page.locator("#scene").evaluate((canvas) => ({
      elapsed: canvas.dataset.simulationElapsed,
      localTracks: canvas.dataset.fleetLocalTracks,
      localWeaponTracks: canvas.dataset.fleetLocalWeaponTracks,
      localWeaponDetails: canvas.dataset.fleetLocalWeaponDetails,
      picture: canvas.dataset.fleetPictureSummary,
      assignments: canvas.dataset.fleetAawAssignments,
      airStates: canvas.dataset.aircraftStates,
    }));
    console.error("Fleet AAW assignment timeout", JSON.stringify(diagnostic, null, 2));
    throw error;
  }
  const result = await page.locator("#scene").evaluate((canvas) => ({
    fleetId: canvas.dataset.fleetId,
    ships: canvas.dataset.fleetShips,
    count: Number(canvas.dataset.fleetShipCount ?? 0),
    companionTargets: canvas.dataset.fleetCompanionTargets,
    members: canvas.dataset.fleetMemberStates,
    stations: canvas.dataset.fleetStationStates,
    localTracks: canvas.dataset.fleetLocalTracks,
    localWeaponTracks: canvas.dataset.fleetLocalWeaponTracks,
    pictureSummary: canvas.dataset.fleetPictureSummary,
    networkTracks: canvas.dataset.fleetNetworkTracks,
    pictureTracks: Number(canvas.dataset.fleetPictureTracks ?? 0),
    otc: canvas.dataset.fleetOtc,
    link11Enabled: canvas.dataset.fleetLink11Enabled,
    link11Ncs: canvas.dataset.fleetLink11Ncs,
    link11RollCalls: Number(canvas.dataset.fleetLink11RollCalls ?? 0),
    link11Delivered: Number(canvas.dataset.fleetLink11Delivered ?? 0),
    link11WeaponAuthority: canvas.dataset.fleetLink11WeaponAuthority,
    aawAssignments: canvas.dataset.fleetAawAssignments,
  }));
  await page.locator("#sbLink16").evaluate((input) => {
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return Number(canvas?.dataset.fleetPictureTracks ?? -1) === 0
      && (canvas?.dataset.fleetNetworkTracks ?? "").split("|")
        .every((entry) => Number(entry.split(":")[1] ?? 0) === 0);
  });
  result.errors = errors;
  result.defaultCount = defaultCount;
  result.disabledCount = disabledCount;
  await page.screenshot({ path: "verification-fleet-scene.png", fullPage: true });
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.defaultCount !== 0 || result.disabledCount !== 0
      || result.count !== 2 || result.otc !== "blue-cgn-9"
      || result.link11Ncs !== "blue-cgn-9" || result.link11RollCalls <= 0
      || result.link11Delivered <= 0 || result.pictureTracks <= 0
      || result.link11WeaponAuthority !== "false"
      || !result.aawAssignments.includes("AAW-")
      || !result.networkTracks.split("|").some((entry) => Number(entry.split(":")[1] ?? 0) > 0)
      || !result.companionTargets.includes("blue-cg-57")
      || !result.members.includes("blue-cgn-9:alive")
      || !result.members.includes("blue-cg-57:alive")
      || !result.localTracks.includes("blue-cgn-9:")) process.exitCode = 1;
} finally {
  await browser.close();
}
