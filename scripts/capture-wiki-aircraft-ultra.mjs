import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const outputRoot = "wiki/assets/aircraft/v1.15.0";
const platformChromePaths = {
  win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
};
const aircraft = [
  { type: "F-14A", slug: "f-14a", stores: true, sweep: "20" },
  { type: "A-6E", slug: "a-6e", stores: true },
  { type: "MIG-29A", slug: "mig-29a", stores: true },
  { type: "TU-16K", slug: "tu-16k", stores: true },
  { type: "E-2C", slug: "e-2c", stores: false },
  { type: "TU-126", slug: "tu-126", stores: false },
];

await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? platformChromePaths[process.platform],
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const runtimeErrors = [];
const warnings = [];
const results = [];

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  page.on("console", message => {
    if (message.type() === "error") {
      runtimeErrors.push({ source: "console", message: message.text() });
    } else if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });
  page.on("pageerror", error => {
    runtimeErrors.push({ source: "pageerror", message: error.message });
  });

  const appUrl = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  const galleryBase = new URL("aircraft-gallery.html", appUrl);

  for (const entry of aircraft) {
    const url = new URL(galleryBase);
    url.searchParams.set("type", entry.type);
    url.searchParams.set("quality", "ultra");
    url.searchParams.set("view", "rear-quarter");
    if (entry.stores) url.searchParams.set("stores", "1");
    if (entry.sweep) url.searchParams.set("sweep", entry.sweep);

    await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForFunction(expected => {
      const canvas = document.querySelector("canvas");
      return canvas?.dataset.galleryReady === "true" &&
        canvas.dataset.aircraftType === expected;
    }, entry.type, { timeout: 15_000 });
    await page.waitForTimeout(150);

    const stats = await page.evaluate(() => window.__aircraftGallery);
    const path = `${outputRoot}/${entry.slug}-ultra-rear-quarter.png`;
    await page.screenshot({ path, fullPage: true });
    results.push({ ...stats, path });
  }

  console.log(JSON.stringify({ captured: results.length, results, runtimeErrors, warnings }, null, 2));
  const invalid = results.some((result, index) =>
    result.type !== aircraft[index].type ||
    result.quality !== "ultra" ||
    result.view !== "rear-quarter" ||
    result.triangles < 10_000 ||
    (aircraft[index].stores && result.mountedWeapons.length === 0));
  if (results.length !== aircraft.length || invalid || runtimeErrors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
