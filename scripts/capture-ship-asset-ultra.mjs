import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, ultra) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) {
      await page.locator("#sbWebGpuUltra").check();
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.locator("#sbStart").click();
    await page.keyboard.press("1");
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 3, null, { timeout: 20_000 });
    await page.keyboard.press("Space");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, -2600);
    await page.waitForTimeout(250);
    const diagnostics = await page.locator("#scene").evaluate(canvas => ({
      hullStations: Number(canvas.dataset.hullStations ?? 0),
      hullSectionPoints: Number(canvas.dataset.hullSectionPoints ?? 0),
      mappedMaterials: Number(canvas.dataset.pbrMappedMaterials ?? 0),
      ultra: canvas.dataset.webGpuUltraStatus,
    }));
    diagnostics.errors = errors;
    if (errors.length || diagnostics.hullStations < 10 || diagnostics.hullSectionPoints < 8 || diagnostics.mappedMaterials < 3) throw new Error(JSON.stringify(diagnostics));
    await page.locator("#scene").screenshot({ path });
    return diagnostics;
  } finally {
    await browser.close();
  }
}

const ultra = await capture("verification-ship-asset-ultra.png", true);
const high = await capture("verification-ship-asset-high.png", false);
console.log(JSON.stringify({ ultra, high }, null, 2));
