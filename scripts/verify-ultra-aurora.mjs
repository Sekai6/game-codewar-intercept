import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/?shortAirValidation=1", { waitUntil: "domcontentloaded", timeout: 15_000 });
  const cg57Option = await page.locator("#sbShip option").evaluateAll(options =>
    options.find(option => option.textContent?.includes("CG-57"))?.value,
  );
  if (!cg57Option) throw new Error("CG-57 ship selector option was not found");
  const versionLabel = await page.locator("#appVersion").textContent();
  if (versionLabel?.trim() !== "v1.1.0") throw new Error(`Unexpected application version: ${versionLabel}`);
  await page.locator("#sbShip").selectOption(cg57Option);
  const extraToggleExists = await page.locator("#sbAuroraEnvironment").count() === 1;
  await page.locator("#sbWebGpuUltra").check();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 20_000 });
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.auroraEnvironment === "false", null, { timeout: 20_000 });
  const baselineWithoutExtra = await page.locator("#scene").evaluate(element => element.dataset.auroraEnvironment);
  await page.getByRole("button", { name: "SCENARIO SETUP" }).click();
  await page.locator("#sbAuroraEnvironment").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.auroraEnvironment === "true", null, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  const canvas = page.locator("#scene");
  const active = await canvas.evaluate(element => ({
    requested: element.dataset.auroraRequested,
    enabled: element.dataset.auroraEnvironment,
    layers: Number(element.dataset.auroraLayers ?? 0),
    ultra: element.dataset.webGpuUltraStatus,
    godRays: element.dataset.environmentGodRayStrength,
  }));
  await canvas.screenshot({ path: "verification-ultra-aurora-tactical.png" });
  await page.keyboard.press("1");
  await page.waitForTimeout(450);
  await canvas.screenshot({ path: "verification-ultra-aurora-ship.png" });
  await canvas.screenshot({ path: "readme-cg57-ultra-aurora.png" });
  await page.getByRole("button", { name: "SCENARIO SETUP" }).click();
  await page.locator("#sbAuroraEnvironment").uncheck();
  await page.locator("#sbWebGpuUltra").uncheck();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "idle", null, { timeout: 10_000 });
  const disabled = await canvas.evaluate(element => ({ ultra: element.dataset.webGpuUltraStatus, enabled: element.dataset.auroraEnvironment }));
  const result = { cg57Option, versionLabel, extraToggleExists, baselineWithoutExtra, active, disabled, errors };
  console.log(JSON.stringify(result, null, 2));
  if (!extraToggleExists || versionLabel?.trim() !== "v1.1.0" || baselineWithoutExtra !== "false" || active.enabled !== "true" || active.layers !== 3 || active.ultra !== "active" || active.godRays !== "0.00" || disabled.ultra !== "idle" || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
