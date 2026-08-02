import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const outputRoot = process.env.SURFACE_GALLERY_OUTPUT ?? "verification-surface-platform-lod";
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--renderer-process-limit=1", "--disable-background-networking"],
});

const platforms = ["cgn-9", "cg-57", "project-1164"];
const viewsByQuality = {
  ultra: ["bow-quarter", "starboard", "top", "stern-quarter"],
  high: ["bow-quarter"],
  standard: ["bow-quarter"],
};
const results = [];
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  const appUrl = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  const galleryBase = new URL("surface-gallery.html", appUrl);

  for (const [quality, views] of Object.entries(viewsByQuality)) {
    await mkdir(`${outputRoot}/${quality}`, { recursive: true });
    for (const platform of platforms) {
      for (const view of views) {
        const url = new URL(galleryBase);
        url.searchParams.set("platform", platform);
        url.searchParams.set("quality", quality);
        url.searchParams.set("view", view);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForFunction(() => document.querySelector("canvas")?.dataset.galleryReady === "true", null, { timeout: 15_000 });
        await page.waitForTimeout(100);
        const path = `${outputRoot}/${quality}/${platform}-${view}.png`;
        await page.screenshot({ path });
        results.push({ ...(await page.evaluate(() => window.__surfaceGallery)), path });
      }
    }
  }

  const tierStats = Object.fromEntries(platforms.map(platform => {
    const values = Object.fromEntries(Object.keys(viewsByQuality).map(quality => {
      const sample = results.find(result => result.platformId === platform && result.quality === quality && result.view === "bow-quarter");
      return [quality, sample?.triangles ?? 0];
    }));
    return [platform, values];
  }));
  console.log(JSON.stringify({ captured: results.length, tierStats, errors, results }, null, 2));
  const invalidTiering = Object.values(tierStats).some(({ ultra, high, standard }) => !(ultra > high && high > standard && standard > 50));
  if (results.length !== 18 || invalidTiering || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
