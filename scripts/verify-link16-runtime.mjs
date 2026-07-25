import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));
try {
  const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  await page.goto(`${baseUrl}?shortAirValidation=1`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbDatalinkEra").selectOption("link16-modernized");
  await page.locator("#sbLink16").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const data = document.querySelector("#scene")?.dataset;
    return (
      Number(data?.link16Delivered ?? 0) > 0 &&
      Number(data?.link16AircraftTracks ?? 0) > 0 &&
      Number(data?.link16ShipCues ?? 0) > 0 &&
      (data?.datalinkDecisionLog ?? "").includes("cue-accepted-search") &&
      (data?.datalinkDecisionLog ?? "").includes("weapon-authorization-rejected") &&
      Number(data?.aarDatalinkEvents ?? 0) > 0 &&
      Number(data?.shipSamShots ?? 0) > 0
    );
  }, null, { timeout: 30_000 });
  const result = await page.locator("#scene").evaluate((canvas) => ({
    queued: Number(canvas.dataset.link16Queued ?? 0),
    transmitted: Number(canvas.dataset.link16Transmitted ?? 0),
    delivered: Number(canvas.dataset.link16Delivered ?? 0),
    meanDelay: Number(canvas.dataset.link16MeanDelay ?? 0),
    aircraftTracks: Number(canvas.dataset.link16AircraftTracks ?? 0),
    shipCues: Number(canvas.dataset.link16ShipCues ?? 0),
    participants: canvas.dataset.link16Participants ?? "",
    trackStates: canvas.dataset.link16TrackStates ?? "",
    samShots: Number(canvas.dataset.shipSamShots ?? 0),
    launchers: canvas.dataset.airDefenseLaunchers ?? "",
    legacyRegistrations: Number(canvas.dataset.airDefenseLegacyRegistrations ?? -1),
    decisionLog: canvas.dataset.datalinkDecisionLog ?? "",
    aarNodes: Number(canvas.dataset.aarDatalinkNodes ?? 0),
    aarTracks: Number(canvas.dataset.aarDatalinkTracks ?? 0),
    aarEvents: Number(canvas.dataset.aarDatalinkEvents ?? 0),
  }));
  await page.getByRole("button", { name: "END EXERCISE / AAR" }).click();
  await page.locator("#aarExportTacview").waitFor({ state: "visible", timeout: 5000 });
  await page.locator('.aar-event-filters button[data-filter="network"]').click();
  result.aarNetworkVisible = await page.locator("#aarEvents .aar-event.network:visible").count();
  result.aarCombatHidden = await page.locator("#aarEvents .aar-event:not(.network):visible").count() === 0;
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#aarExportTacview").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const acmi = downloadPath ? await readFile(downloadPath, "utf8") : "";
  result.acmiHasNetworkMetadata = acmi.includes("0,DataLink=link16-modernized") && acmi.includes("0,DataLinkEnabled=1");
  result.acmiHasEstimatedTracks = acmi.includes("Type=Misc+Bullseye") && acmi.includes("EngagementQuality=Cue");
  result.acmiHasDecisionChain = acmi.includes("CUE ACCEPTED FOR SEARCH") && acmi.includes("CUE REJECTED FOR WEAPON AUTHORIZATION") && acmi.includes("ORGANIC RADAR ACQUISITION AFTER CUE");
  result.acmiHasRadioWeapons = /Type=Weapon\+Missile,Name=LINK1[16]/.test(acmi);
  result.errors = errors;
  const redHasTracks = result.trackStates
    .split("|")
    .filter((state) => state.startsWith("red-"))
    .some((state) => Number(state.split(":").at(-1)) > 0);
  console.log(JSON.stringify({ ...result, redHasTracks }, null, 2));
  if (
    errors.length ||
    result.delivered <= 0 ||
    result.meanDelay <= 0 ||
    result.aircraftTracks <= 0 ||
    result.shipCues <= 0 ||
    result.participants.includes("red-") ||
    redHasTracks ||
    result.samShots <= 0 ||
    !/MK 10|MK 41/.test(result.launchers) ||
    result.legacyRegistrations !== 0
    || !result.decisionLog.includes("cue-accepted-search")
    || !result.decisionLog.includes("weapon-authorization-rejected")
    || result.aarNodes <= 0 || result.aarTracks <= 0 || result.aarEvents <= 0
    || result.aarNetworkVisible <= 0 || !result.aarCombatHidden
    || !result.acmiHasNetworkMetadata || !result.acmiHasEstimatedTracks
    || !result.acmiHasDecisionChain || result.acmiHasRadioWeapons
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
