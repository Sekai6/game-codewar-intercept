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
  await page.locator("#sbFleetFormation").selectOption("line-abreast");
  await page.locator("#sbFleetMode").check();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.fleetShips?.split("|").length ?? 0) === 2);
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.fleetFormation === "line-abreast");
  await page.locator("#sbFleetFormation").selectOption("column");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.fleetFormation === "column");
  await page.locator("#sbFleetMode").uncheck();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.fleetShipCount ?? -1) === 0);
  const disabledState = await page.locator("#scene").evaluate((canvas) => ({
    count: Number(canvas.dataset.fleetShipCount),
    overview: canvas.dataset.cameraFleetOverview,
    formation: canvas.dataset.fleetFormation,
  }));
  const disabledCount = disabledState.count;
  const disabledOverview = disabledState.overview;
  const disabledFormation = disabledState.formation;
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
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetElectronicWarfare ?? "")
    .includes("blue-cg-57:ECM=1,SRBOC=1,R=12,D=0"));
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetCiws ?? "")
    .includes("blue-cg-57:AUTO=1,R=1800,M=2/2,E=0"));
  await page.getByRole("button", { name: "CIWS: AUTO" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetCiws ?? "")
    .includes("blue-cg-57:AUTO=0,R=1800,M=2/2,E=0"));
  await page.getByRole("button", { name: "CIWS: HOLD" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetCiws ?? "")
    .includes("blue-cg-57:AUTO=1,R=1800,M=2/2,E=0"));
  await page.getByRole("button", { name: "SHIP ECM: AUTO" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetElectronicWarfare ?? "")
    .includes("blue-cg-57:ECM=0,SRBOC=1"));
  await page.getByRole("button", { name: "SHIP ECM: HOLD" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetElectronicWarfare ?? "")
    .includes("blue-cg-57:ECM=1,SRBOC=1"));
  await page.getByRole("button", { name: "SRBOC: AUTO" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetElectronicWarfare ?? "")
    .includes("blue-cg-57:ECM=1,SRBOC=0"));
  await page.getByRole("button", { name: "SRBOC: HOLD" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetElectronicWarfare ?? "")
    .includes("blue-cg-57:ECM=1,SRBOC=1"));
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
      engagements: canvas.dataset.fleetEngagements,
      localEngagements: canvas.dataset.fleetLocalEngagements,
      airStates: canvas.dataset.aircraftStates,
    }));
    console.error("Fleet AAW assignment timeout", JSON.stringify(diagnostic, null, 2));
    throw error;
  }
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetPhysicalLaunches ?? "")
    .includes("blue-cg-57:"), null, { timeout: 45_000 });
  await page.screenshot({ path: "verification-fleet-escort-launch.png", fullPage: true });
  const result = await page.locator("#scene").evaluate((canvas) => ({
    fleetId: canvas.dataset.fleetId,
    formation: canvas.dataset.fleetFormation,
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
    engagements: canvas.dataset.fleetEngagements,
    localEngagements: canvas.dataset.fleetLocalEngagements,
    electronicWarfare: canvas.dataset.fleetElectronicWarfare,
    ciws: canvas.dataset.fleetCiws,
    damage: canvas.dataset.fleetDamage,
    surfaceAssignments: canvas.dataset.fleetSurfaceAssignments,
    physicalLaunches: canvas.dataset.fleetPhysicalLaunches,
  }));
  await page.keyboard.press("n");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.networkObserver === "true");
  await page.keyboard.press("0");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.cameraFleetOverview === "true");
  result.fleetOverviewCamera = true;
  Object.assign(result, await page.locator("#scene").evaluate((canvas) => ({
    networkObserverFleetShips: Number(canvas.dataset.networkObserverFleetShips ?? 0),
    networkObserverFleetAssignments: Number(canvas.dataset.networkObserverFleetAssignments ?? 0),
    networkObserverFleetWeaponsAway: Number(canvas.dataset.networkObserverFleetWeaponsAway ?? 0),
    networkObserverObjects: Number(canvas.dataset.networkObserverObjects ?? 0),
  })));
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
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbShip").selectOption("ticonderoga");
  await page.locator("#sbAirCombat").uncheck();
  await page.locator("#sbStart").click();
  await page.locator("#sbFleetMode").evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.fleetCiws ?? "")
    .includes("blue-cgn-9:AUTO=1,R=1200,M=2/2,E=0"));
  result.swappedCompanionCiws = await page.locator("#scene").evaluate((canvas) => canvas.dataset.fleetCiws);
  await page.screenshot({ path: "verification-fleet-scene.png", fullPage: true });
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.defaultCount !== 0 || result.disabledCount !== 0
      || disabledOverview === "true"
      || disabledFormation !== ""
      || result.formation !== "column"
      || result.count !== 2 || result.otc !== "blue-cgn-9"
      || result.link11Ncs !== "blue-cgn-9" || result.link11RollCalls <= 0
      || result.link11Delivered <= 0 || result.pictureTracks <= 0
      || result.link11WeaponAuthority !== "false"
      || !result.aawAssignments.includes("AAW-")
      || !result.engagements.split("|").every((entry) => /:(assigned|weapons-away):[01]$/.test(entry))
      || !result.localEngagements.includes("blue-cgn-9:0")
      || !result.electronicWarfare.includes("blue-cg-57:ECM=1,SRBOC=1,R=12")
      || !result.ciws.includes("blue-cg-57:AUTO=1,R=1800,M=2/2")
      || !result.damage?.includes("blue-cg-57:H=")
      || !result.physicalLaunches?.includes("blue-cg-57:")
      || !result.swappedCompanionCiws.includes("blue-cgn-9:AUTO=1,R=1200,M=2/2")
      || !result.networkTracks.split("|").some((entry) => Number(entry.split(":")[1] ?? 0) > 0)
      || !result.companionTargets.includes("blue-cg-57")
      || result.networkObserverFleetShips !== 2
      || result.networkObserverFleetAssignments < 1
      || result.networkObserverObjects < result.networkObserverFleetShips
      || result.fleetOverviewCamera !== true
      || !result.members.includes("blue-cgn-9:alive")
      || !result.members.includes("blue-cg-57:alive")
      || !result.localTracks.includes("blue-cgn-9:")) process.exitCode = 1;
} finally {
  await browser.close();
}
