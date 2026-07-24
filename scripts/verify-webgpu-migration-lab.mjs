import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.stack ?? error.message));
try {
  const base = process.env.APP_URL ?? "http://127.0.0.1:5173";
  await page.goto(`${base.replace(/\/$/, "")}/webgpu-lab.html`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector("#webgpu-lab")?.dataset.storageParticles === "32768", null, { timeout: 30_000 });
  await page.waitForFunction(() => Number(document.querySelector("#webgpu-lab")?.dataset.renderedFrames ?? 0) >= 20, null, { timeout: 15_000 });
  const result = await page.locator("#webgpu-lab").evaluate(canvas => ({ ...canvas.dataset }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.backend !== "WEBGPU" || result.pbr !== "MESH_STANDARD_NODE" || result.tiledLights !== "24" || result.storageParticles !== "32768" || result.depthOcclusion !== "SHARED_RENDERER_DEPTH" || result.tslOcean !== "FFT_JACOBIAN_KELVIN_BOW_WAKE" || result.fftOceanResource !== "GPU_COMPUTE_READBACK_UPLOAD_16X64" || result.tslSky !== "BRUNETON_3_LUT_AFTERNOON" || result.brunetonResource !== "COMPUTE_BRUNETON_3_LUT_READBACK_UPLOAD" || Number(result.renderedFrames) < 20 || Number(result.drawCalls) < 1) process.exitCode = 1;
  await page.locator("#webgpu-lab").screenshot({ path: "verification-webgpu-migration-lab.png" });
} finally { await browser.close(); }
