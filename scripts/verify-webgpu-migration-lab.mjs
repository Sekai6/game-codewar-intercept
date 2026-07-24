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
  const gtao = ["off", "debug"].includes(process.env.GTAO) ? process.env.GTAO : "on";
  const traa = process.env.TRAA === "off" ? "off" : "on";
  const ssrTest = process.env.SSR_TEST === "on" ? "on" : "off";
  const froxel = ["on", "debug"].includes(process.env.FROXEL) ? process.env.FROXEL : "off";
  const froxelTest = process.env.FROXEL_TEST === "on" ? "on" : "off";
  const ssr = ["on", "debug"].includes(process.env.SSR) ? process.env.SSR : "off";
  const hiz = ["on", "depth-debug", "range-debug"].includes(process.env.HIZ) ? process.env.HIZ : "off";
  await page.goto(`${base.replace(/\/$/, "")}/webgpu-lab.html?gtao=${gtao}&traa=${traa}&ssr=${ssr}&hiz=${hiz}&ssrTest=${ssrTest}&froxel=${froxel}&froxelTest=${froxelTest}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector("#webgpu-lab")?.dataset.storageParticles === "32768", null, { timeout: 30_000 });
  await page.waitForFunction(() => Number(document.querySelector("#webgpu-lab")?.dataset.renderedFrames ?? 0) >= 20, null, { timeout: 45_000 });
  if (froxel !== "off") await page.waitForFunction(() => document.querySelector("#webgpu-lab")?.dataset.froxelCenter !== undefined, null, { timeout: 10_000 });
  if (hiz !== "off") await page.waitForFunction(() => document.querySelector("#webgpu-lab")?.dataset.hizBaseCenter !== undefined, null, { timeout: 10_000 });
  const result = await page.locator("#webgpu-lab").evaluate(canvas => ({ ...canvas.dataset }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  const expectedGtao = gtao === "off" ? "OFF_AB_BASELINE" : gtao === "debug" ? "DEBUG_AO_OUTPUT" : "NATIVE_HALF_RES_16_SAMPLE";
  const expectedTraa = traa === "off" ? "OFF_AB_BASELINE" : "NATIVE_TRAA_VELOCITY_MRT_NEIGHBOR_CLAMP";
  const expectedSsr = ssr === "debug" ? "DEBUG_FIXED_STEP_OUTPUT" : ssr === "on" ? "FIXED_STEP_BASELINE_HALF_RES" : "OFF";
  const hizMinimum = Number(result.hizLastMinimum);
  const hizMaximum = Number(result.hizLastMaximum);
  const hizCenter = Number(result.hizBaseCenter);
  const validHiz = hiz !== "off" ? /^MIN_MAX_DEPTH_COMPUTE_\d+_LEVEL$/.test(result.hiz ?? "") && /^LINEAR_VIEW_DISTANCE_/.test(result.hizSpace ?? "") && result.hizConsumer === "TSL_ZERO_READBACK_MIP_SAMPLING" && /^depth/.test(result.hizSource ?? "") && Number(result.hizUpdates) >= 2 && Number.isFinite(hizMinimum) && hizMinimum > 0 && Number.isFinite(hizMaximum) && hizMaximum >= hizMinimum && hizMaximum <= 500.01 && Number.isFinite(hizCenter) && hizCenter > 0 && hizCenter <= 500.01 : result.hiz === "OFF";
  const froxelCenter = (result.froxelCenter ?? "").split(",").map(Number);
  const validFroxel = froxel === "off"
    ? result.froxel === "OFF"
    : /^WORLD_LOG_STORAGE3D_120X68X48_24_LIGHT$/.test(result.froxel ?? "") && result.froxelPath === "WORLD_RECONSTRUCT_COMPUTE_TO_TSL_ZERO_READBACK" && froxelCenter.length === 4 && froxelCenter.every(Number.isFinite) && froxelCenter[3] > 0;
  if (errors.length || result.backend !== "WEBGPU" || result.pbr !== "MESH_STANDARD_NODE" || result.tiledLights !== "24" || result.storageParticles !== "32768" || result.storageParticleRole !== "EVENT_SPLASH_WATER_COLUMN" || result.storageParticlePath !== "COMPUTE_TO_POINTS_ZERO_READBACK" || result.temporalPipeline !== expectedTraa || result.gtao !== expectedGtao || result.gtaoLayers !== "OPAQUE_HULL_ONLY" || result.ssr !== expectedSsr || !validHiz || !validFroxel || result.depthOcclusion !== "SHARED_RENDERER_DEPTH" || result.tslOcean !== "FFT_JACOBIAN_KELVIN_WAKE_SPLASH_RING" || result.splashInput !== "LOCAL_EVENT_DISPLACEMENT_FOAM" || result.fftOceanResource !== "GPU_COMPUTE_READBACK_UPLOAD_16X64" || result.tslSky !== "BRUNETON_3_LUT_AFTERNOON" || result.brunetonResource !== "COMPUTE_BRUNETON_3_LUT_READBACK_UPLOAD" || Number(result.renderedFrames) < 20 || Number(result.drawCalls) < 1) process.exitCode = 1;
  await page.locator("#webgpu-lab").screenshot({ path: `verification-webgpu-migration-lab-gtao-${gtao}-ssr-${ssr}-froxel-${froxel}-test-${froxelTest}.png` });
} catch (error) {
  const diagnostic = await page.locator("#webgpu-lab").evaluate(canvas => ({ ...canvas.dataset })).catch(() => ({}));
  console.error(JSON.stringify({ error: error.stack ?? error.message, diagnostic, browserErrors: errors }, null, 2));
  process.exitCode = 1;
} finally { await browser.close(); }
