import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const base = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

async function decode(page, buffer) {
  return page.evaluate(async encoded => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, image.width, image.height).data);
  }, buffer.toString("base64"));
}

function difference(first, second) {
  let sum = 0;
  let changed = 0;
  for (let index = 0; index < first.length; index += 4) {
    const delta = Math.abs(first[index] - second[index]) + Math.abs(first[index + 1] - second[index + 1]) + Math.abs(first[index + 2] - second[index + 2]);
    sum += delta / 3;
    if (delta > 30) changed++;
  }
  return { meanAbsoluteDelta: sum / (first.length / 4), changedPixels: changed };
}

function targetEnergy(pixels, center, excludeCenter = null) {
  let energy = 0;
  let samples = 0;
  const width = 1280;
  const minX = Math.max(0, Math.floor(center.x - 38));
  const maxX = Math.min(width - 1, Math.ceil(center.x + 38));
  const minY = Math.max(0, Math.floor(center.y - 18));
  const maxY = Math.min(719, Math.ceil(center.y + 18));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (excludeCenter && Math.abs(x - excludeCenter.x) < 34 && Math.abs(y - excludeCenter.y) < 15) continue;
    const index = (y * width + x) * 4;
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    energy += Math.max(0, red - blue * 0.72) + Math.max(0, green - blue * 0.42);
    samples++;
  }
  return energy / Math.max(1, samples);
}

async function capture(traa) {
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.stack ?? error.message));
  try {
    await page.goto(`${base}/webgpu-lab.html?gtao=off&traa=${traa}&temporalTest=on`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForFunction(() => Number(document.querySelector("#webgpu-lab")?.dataset.renderedFrames ?? 0) >= 40, null, { timeout: 45_000 });
    const first = await page.locator("#webgpu-lab").screenshot({ path: `verification-webgpu-temporal-${traa}-a.png` });
    const firstTarget = await page.locator("#webgpu-lab").evaluate(canvas => ({ x: Number(canvas.dataset.temporalTargetX), y: Number(canvas.dataset.temporalTargetY) }));
    const firstFrame = Number(await page.locator("#webgpu-lab").getAttribute("data-rendered-frames"));
    await page.evaluate(() => window.__stepWebgpuLab());
    await page.waitForFunction(frame => Number(document.querySelector("#webgpu-lab")?.dataset.renderedFrames ?? 0) >= frame + 1, firstFrame, { timeout: 10_000 });
    await page.evaluate(() => window.__stepWebgpuLab());
    await page.waitForFunction(frame => Number(document.querySelector("#webgpu-lab")?.dataset.renderedFrames ?? 0) >= frame + 2, firstFrame, { timeout: 10_000 });
    const second = await page.locator("#webgpu-lab").screenshot({ path: `verification-webgpu-temporal-${traa}-b.png` });
    const secondTarget = await page.locator("#webgpu-lab").evaluate(canvas => ({ x: Number(canvas.dataset.temporalTargetX), y: Number(canvas.dataset.temporalTargetY) }));
    const dataset = await page.locator("#webgpu-lab").evaluate(canvas => ({ ...canvas.dataset }));
    const firstPixels = await decode(page, first);
    const secondPixels = await decode(page, second);
    const metric = {
      ...difference(firstPixels, secondPixels),
      currentTargetEnergy: targetEnergy(secondPixels, secondTarget),
      oldPositionResidual: targetEnergy(secondPixels, firstTarget, secondTarget),
      targetTravelPixels: Math.hypot(secondTarget.x - firstTarget.x, secondTarget.y - firstTarget.y),
    };
    return { traa, dataset, metric, errors };
  } finally {
    await browser.close();
  }
}

const baseline = await capture("off");
const temporal = await capture("on");
const result = { baseline, temporal };
const baselineResidualRatio = baseline.metric.oldPositionResidual / Math.max(0.001, baseline.metric.currentTargetEnergy);
const temporalResidualRatio = temporal.metric.oldPositionResidual / Math.max(0.001, temporal.metric.currentTargetEnergy);
result.baselineResidualRatio = baselineResidualRatio;
result.temporalResidualRatio = temporalResidualRatio;
result.residualRatioImprovement = 1 - temporalResidualRatio / baselineResidualRatio;
console.log(JSON.stringify(result, null, 2));
if (baseline.errors.length || temporal.errors.length || baseline.dataset.temporalTest !== "FROZEN_BACKGROUND_FAST_TARGET" || temporal.dataset.temporalTest !== "FROZEN_BACKGROUND_FAST_TARGET" || temporal.dataset.temporalPipeline !== "NATIVE_TRAA_VELOCITY_MRT_NEIGHBOR_CLAMP" || temporal.metric.targetTravelPixels < 8 || temporalResidualRatio > baselineResidualRatio * 0.95 || temporal.metric.currentTargetEnergy < baseline.metric.currentTargetEnergy) process.exitCode = 1;
