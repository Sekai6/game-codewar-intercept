import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/?validationTimeScale=16", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbHighQualityEnvironment").uncheck();
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 210, null, { timeout: 60_000 });

  const events = await page.locator("#scene").getAttribute("data-scenario-aar-events") ?? "";
  const conflicts = events.split("|").filter(event => event.includes("TRACK CONFLICT"));
  const updates = conflicts.filter(event => event.includes("TRACK CONFLICT UPDATED"));
  const byTrack = new Map();
  for (const event of updates) {
    const [timeText, body] = event.split(":", 2);
    const trackId = body.split(" / ")[1];
    const times = byTrack.get(trackId) ?? [];
    times.push(Number(timeText));
    byTrack.set(trackId, times);
  }
  const intervals = [...byTrack.values()].flatMap(times => times.slice(1).map((time, index) => time - times[index]));
  const minimumUpdateInterval = intervals.length ? Math.min(...intervals) : null;
  const result = {
    total: conflicts.length,
    detected: conflicts.filter(event => event.includes("TRACK CONFLICT DETECTED")).length,
    updated: updates.length,
    resolved: conflicts.filter(event => event.includes("TRACK CONFLICT RESOLVED")).length,
    tracksWithUpdates: byTrack.size,
    minimumUpdateInterval,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  assert.equal(errors.length, 0);
  assert(minimumUpdateInterval === null || minimumUpdateInterval >= 7.9, "same conflict pair updated faster than the throttle interval");
} finally {
  await browser.close();
}
