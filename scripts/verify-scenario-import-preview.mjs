import { chromium } from "playwright-core";
import path from "node:path";

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
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil:"domcontentloaded", timeout:15_000 });
  const file = path.resolve("src/scenarios/full-spectrum-blackout/scenario.json");
  const input = page.locator('.scenario-io-controls input[type="file"]');
  const initialSelection = await page.locator("#sbScenario").inputValue();
  await input.setInputFiles({ name:"invalid.json", mimeType:"application/json", buffer:Buffer.from('{"schemaVersion":1,"id":"invalid"}') });
  await page.waitForTimeout(150);
  const invalidAtomic = {
    selection:await page.locator("#sbScenario").inputValue(),
    previewCount:await page.locator(".scenario-import-preview").count(),
  };
  await input.setInputFiles(file);
  await page.locator(".scenario-import-preview").waitFor({ state:"visible" });
  const preview = await page.locator(".scenario-import-preview").innerText();
  await page.locator(".scenario-import-preview [data-cancel]").click();
  const cancelled = await page.locator(".scenario-import-preview").count() === 0;
  await input.setInputFiles(file);
  await page.locator(".scenario-import-preview [data-confirm]").click();
  const loaded = await page.locator("#sbScenario").inputValue();
  const userOption = await page.locator('#sbScenario option[data-user-scenario="true"]').count();
  await page.locator("#sbStart").click();
  const importedProvenance = await page.locator(".scenario-source.imported").isVisible();
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil:"domcontentloaded", timeout:15_000 });
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator('.scenario-io-controls [data-copy]').click();
  const copied = {
    selection:await page.locator("#sbScenario").inputValue(),
    userOption:await page.locator('#sbScenario option[data-user-scenario="true"]').count(),
  };
  console.log(JSON.stringify({ preview: preview.slice(0, 260), initialSelection, invalidAtomic, cancelled, loaded, userOption, importedProvenance, copied, errors }, null, 2));
  if (errors.length || invalidAtomic.selection !== initialSelection || invalidAtomic.previewCount !== 0
      || !preview.includes("SCHEMA") || !preview.includes("VALIDATION PASSED") || !cancelled
      || loaded !== "full-spectrum-blackout" || userOption !== 1 || !importedProvenance
      || copied.selection !== "full-spectrum-blackout-user-copy" || copied.userOption !== 1) process.exitCode = 1;
} finally { await browser.close(); }
