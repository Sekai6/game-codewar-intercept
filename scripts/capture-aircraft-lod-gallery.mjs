import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const outputRoot = "verification-aircraft-v11";
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});

const aircraft = ["F-14A", "A-6E", "MIG-29A", "TU-16K", "E-2C", "TU-126"];
const viewsByQuality = {
  ultra: ["front", "right", "top", "rear-quarter"],
  high: ["right", "rear-quarter"],
  low: ["right", "rear-quarter"],
};
const results = [];
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  const appUrl = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  const galleryBase = new URL("aircraft-gallery.html", appUrl);

  for (const quality of Object.keys(viewsByQuality)) {
    await mkdir(`${outputRoot}/${quality}`, { recursive: true });
    for (const type of aircraft) {
      for (const view of viewsByQuality[quality]) {
        const url = new URL(galleryBase);
        url.searchParams.set("type", type);
        url.searchParams.set("quality", quality);
        url.searchParams.set("view", view);
        if (type === "F-14A") url.searchParams.set("sweep", "20");
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForFunction(() => document.querySelector("canvas")?.dataset.galleryReady === "true", null, { timeout: 15_000 });
        await page.waitForTimeout(120);
        const slug = type.toLowerCase();
        const path = `${outputRoot}/${quality}/${slug}-${view}.png`;
        await page.screenshot({ path });
        const stats = await page.evaluate(() => window.__aircraftGallery);
        results.push({ ...stats, path });
      }
    }
  }

  const f14Swept = new URL(galleryBase);
  f14Swept.searchParams.set("type", "F-14A");
  f14Swept.searchParams.set("quality", "ultra");
  f14Swept.searchParams.set("view", "top");
  f14Swept.searchParams.set("sweep", "68");
  await page.goto(f14Swept.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.galleryReady === "true", null, { timeout: 15_000 });
  await page.screenshot({ path: `${outputRoot}/ultra/f-14a-top-sweep68.png` });
  results.push({ ...(await page.evaluate(() => window.__aircraftGallery)), path: `${outputRoot}/ultra/f-14a-top-sweep68.png` });

  await mkdir(`${outputRoot}/armed`, { recursive: true });
  for (const { type, view } of [
    { type: "F-14A", view: "rear-quarter" },
    { type: "A-6E", view: "rear-quarter" },
    { type: "MIG-29A", view: "rear-quarter" },
    { type: "TU-16K", view: "right" },
  ]) {
    const armedUrl = new URL(galleryBase);
    armedUrl.searchParams.set("type", type);
    armedUrl.searchParams.set("quality", "ultra");
    armedUrl.searchParams.set("view", view);
    armedUrl.searchParams.set("stores", "1");
    await page.goto(armedUrl.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForFunction(() => document.querySelector("canvas")?.dataset.galleryReady === "true", null, { timeout: 15_000 });
    await page.waitForTimeout(120);
    const path = `${outputRoot}/armed/${type.toLowerCase()}-${view}.png`;
    await page.screenshot({ path });
    results.push({ ...(await page.evaluate(() => window.__aircraftGallery)), path });
  }

  const tierStats = Object.fromEntries(aircraft.map(type => {
    const values = Object.fromEntries(["ultra", "high", "low"].map(quality => {
      const sample = results.find(result => result.type === type && result.quality === quality && result.view === "right");
      return [quality, sample?.triangles ?? 0];
    }));
    return [type, values];
  }));
  console.log(JSON.stringify({ captured: results.length, tierStats, errors }, null, 2));
  const invalidTiering = Object.values(tierStats).some(({ ultra, high, low }) => !(ultra > high && high > low && low > 100));
  const armedResults = results.filter(result => result.stores);
  const armedCoverage = armedResults.length === 4 && armedResults.every(result => result.mountedWeapons?.length > 0);
  if (results.length !== 53 || invalidTiering || !armedCoverage || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
