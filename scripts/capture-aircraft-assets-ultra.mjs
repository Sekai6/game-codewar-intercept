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
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("joint");
  await page.locator("#sbHighQualityEnvironment").check();
  await page.locator("#sbWebGpuUltra").check();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 20_000 });
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === 6, null, { timeout: 20_000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  const captured = new Set();
  for (let attempt = 0; attempt < 8 && captured.size < 4; attempt++) {
    await page.keyboard.press("6");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(900);
    const id = await page.locator("#scene").getAttribute("data-camera-aircraft-id") ?? "";
    const type = id.match(/(F-14A|MIG-29A|TU-16K|A-6E)/)?.[1];
    if (!type || captured.has(type)) continue;
    await page.locator("#scene").screenshot({ path: `verification-aircraft-${type.toLowerCase()}-ultra.png` });
    captured.add(type);
  }
  if (!captured.has("MIG-29A")) {
    await page.getByRole("button", { name: "SCENARIO SETUP" }).click();
    await page.locator("#sbAirPreset").selectOption("fighter");
    await page.locator("#sbStart").click();
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === 4, null, { timeout: 20_000 });
    await page.keyboard.press("Space");
    await page.keyboard.press("8");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(900);
    const id = await page.locator("#scene").getAttribute("data-camera-aircraft-id") ?? "";
    if (id.includes("MIG-29A")) {
      await page.locator("#scene").screenshot({ path: "verification-aircraft-mig-29a-ultra.png" });
      captured.add("MIG-29A");
    }
  }
  const result = { captured: [...captured], mappedMaterials: Number(await page.locator("#scene").getAttribute("data-pbr-mapped-materials") ?? 0), errors };
  console.log(JSON.stringify(result, null, 2));
  if (captured.size < 4 || result.mappedMaterials < 4 || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
