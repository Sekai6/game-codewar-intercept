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
    await page.locator("#sbPlatform").selectOption("slava-moskva");
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) {
      await page.locator("#sbWebGpuUltra").check();
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.locator("#sbStart").click();
    await page.keyboard.press("5");
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 1, null, { timeout: 20_000 });
    await page.keyboard.press("Space");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, -2400);
    await page.waitForTimeout(300);
    const diagnostics = await page.locator("#scene").evaluate(canvas => ({
      platform: document.querySelector("#sbPlatform")?.value ?? "",
      mappedMaterials: Number(canvas.dataset.pbrMappedMaterials ?? 0),
      ultra: canvas.dataset.webGpuUltraStatus,
    }));
    diagnostics.errors = errors;
    if (errors.length || diagnostics.platform !== "slava-moskva" || diagnostics.mappedMaterials < 3) throw new Error(JSON.stringify(diagnostics));
    await page.locator("#scene").screenshot({ path });
    if (ultra) {
      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(300);
      await page.locator("#scene").screenshot({ path: "verification-moskva-asset-medium-ultra.png" });
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(300);
      await page.locator("#scene").screenshot({ path: "verification-moskva-asset-low-ultra.png" });
    }
    return diagnostics;
  } finally {
    await browser.close();
  }
}

const high = await capture("verification-moskva-asset-high.png", false);
const ultra = await capture("verification-moskva-asset-ultra.png", true);
console.log(JSON.stringify({ high, ultra }, null, 2));
