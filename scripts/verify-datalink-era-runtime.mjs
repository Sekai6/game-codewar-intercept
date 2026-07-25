import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function runCase(era, enabled) {
  await page.goto(`${baseUrl}?shortAirValidation=1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbDatalinkEra").selectOption(era);
  const checkbox = page.locator("#sbLink16");
  if (enabled) await checkbox.check();
  else if (await checkbox.isEnabled()) await checkbox.uncheck();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  if (enabled && era !== "ntu-baseline")
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.link16Delivered ?? 0) > 0, null, { timeout: 20_000 });
  else await page.waitForTimeout(2500);
  return page.locator("#scene").evaluate((canvas) => ({
    era: canvas.dataset.datalinkEra,
    enabled: canvas.dataset.link16Enabled,
    cecAvailable: canvas.dataset.cecAvailable,
    participants: canvas.dataset.link16Participants ?? "",
    link11Participants: canvas.dataset.link11Participants ?? "",
    link11Ncs: canvas.dataset.link11Ncs ?? "",
    link11RollCalls: Number(canvas.dataset.link11RollCalls ?? 0),
    delivered: Number(canvas.dataset.link16Delivered ?? 0),
    shipCues: Number(canvas.dataset.link16ShipCues ?? 0),
    tracks: canvas.dataset.link16TrackStates ?? "",
  }));
}

try {
  const baseline = await runCase("ntu-baseline", true);
  const baselineDisconnected = await runCase("ntu-baseline", false);
  const transition = await runCase("jtids-transition", true);
  const modernized = await runCase("link16-modernized", true);
  const disconnected = await runCase("link16-modernized", false);
  const result = { baseline, baselineDisconnected, transition, modernized, disconnected, errors };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length ||
    baseline.participants !== "" || baseline.delivered !== 0 ||
    !baseline.link11Participants.includes("blue-surface-ship") ||
    baseline.link11Ncs !== "blue-surface-ship" || baseline.link11RollCalls <= 0 ||
    baselineDisconnected.link11Participants !== "" ||
    !transition.participants.includes("F-14A") ||
    transition.participants.includes("A-6E") ||
    transition.participants.includes("surface-ship") ||
    !transition.link11Participants.includes("blue-surface-ship") ||
    transition.delivered <= 0 ||
    !modernized.participants.includes("F-14A") ||
    !modernized.participants.includes("A-6E") ||
    !modernized.participants.includes("blue-surface-ship") ||
    modernized.link11Participants !== "" ||
    modernized.delivered <= 0 ||
    disconnected.participants !== "" || disconnected.delivered !== 0 ||
    modernized.cecAvailable !== "false"
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
