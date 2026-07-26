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
  await page.locator("#sbHighQualityEnvironment").check();
  await page.locator("#sbWebGpuUltra").check();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 20_000 });
  const captured = new Set();
  const scene = page.locator("#scene");

  async function startPreset(preset, expectedAircraft, first = false) {
    if (!first) await page.getByRole("button", { name: "SCENARIO SETUP" }).click();
    await page.locator("#sbAirPreset").selectOption(preset);
    await page.locator("#sbStart").click();
    await page.waitForFunction(
      expected => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === expected,
      expectedAircraft,
      { timeout: 20_000 },
    );
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }

  async function captureTypes(types, maxAttempts) {
    for (let attempt = 0; attempt < maxAttempts && types.some(type => !captured.has(type)); attempt++) {
      await page.keyboard.press("6");
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(700);
      const id = await scene.getAttribute("data-camera-aircraft-id") ?? "";
      const type = types.find(candidate => id.includes(candidate));
      if (!type || captured.has(type)) continue;
      const slug = type.toLowerCase();
      await scene.screenshot({ path: `verification-aircraft-${slug}-ultra.png` });
      const box = await scene.boundingBox();
      if (box) {
        const startX = box.x + box.width * .5;
        const startY = box.y + box.height * .5;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + box.width * .14, startY - box.height * .04, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(350);
        await scene.screenshot({ path: `verification-aircraft-${slug}-side-ultra.png` });
        await page.mouse.move(startX + box.width * .14, startY - box.height * .04);
        await page.mouse.down();
        await page.mouse.move(startX, startY, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(200);
      }
      captured.add(type);
    }
  }

  await startPreset("joint", 6, true);
  await captureTypes(["F-14A", "TU-16K", "A-6E"], 10);
  await startPreset("fighter", 4);
  await captureTypes(["MIG-29A"], 6);
  await startPreset("aew", 6);
  await captureTypes(["E-2C", "TU-126"], 10);

  const result = { captured: [...captured], mappedMaterials: Number(await page.locator("#scene").getAttribute("data-pbr-mapped-materials") ?? 0), errors };
  console.log(JSON.stringify(result, null, 2));
  if (captured.size < 6 || result.mappedMaterials < 4 || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
