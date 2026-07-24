import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1&clusteredValidation=explosion`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbHighQualityEnvironment").check();
  await page.locator("#sbWebGpuUltra").check();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 30_000 });
  await page.locator("#sbStart").click();
  await page.keyboard.press("1");
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuUltraClusteredOccupied ?? 0) > 0, null, { timeout: 20_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    status: canvas.dataset.webGpuUltraStatus,
    clustered: canvas.dataset.webGpuUltraClustered,
    error: canvas.dataset.webGpuUltraClusteredError,
    lights: Number(canvas.dataset.webGpuUltraClusteredLights ?? 0),
    occupied: Number(canvas.dataset.webGpuUltraClusteredOccupied ?? 0),
    updates: Number(canvas.dataset.webGpuUltraClusteredUpdates ?? 0),
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.status !== "active" || result.clustered !== "FORWARD_PLUS_32X18X24_64" || result.error || result.lights < 1 || result.occupied < 1 || result.updates < 1) process.exitCode = 1;
} finally { await browser.close(); }
