import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan,UseSkiaRenderer", "--use-angle=vulkan", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
const audioResponses = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if (response.url().includes("/audio/silent-meridian/")) audioResponses.push({ url:response.url(), status:response.status() }); });
try {
  await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationScenarioOffset=20`, { waitUntil:"domcontentloaded", timeout:15_000 });
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  const briefingMap = {
    visible: await page.locator(".scenario-theater-map svg").isVisible(),
    friendly: await page.locator(".scenario-theater-map .friendly").count(),
    routes: await page.locator(".scenario-theater-map .route").count(),
    zones: await page.locator(".scenario-theater-map .zone").count(),
    text: await page.locator(".scenario-briefing").innerText(),
  };
  const requiredControlHints = ["1–3", "4", "6–9", "N", "Shift+N", "Space", "TIME", "AAR"];
  const missingControlHints = requiredControlHints.filter((hint) => !briefingMap.text.includes(hint));
  const seedBefore = await page.locator(".scenario-seed b").innerText();
  await page.locator(".scenario-briefing [data-regenerate]").click();
  await page.locator(".scenario-seed b").waitFor({ state:"visible" });
  const seedAfter = await page.locator(".scenario-seed b").innerText();
  const regenerate = {
    seedBefore,
    seedAfter,
    changed: seedBefore !== seedAfter,
    briefingVisible: await page.locator(".scenario-briefing").isVisible(),
    simulationElapsed: await page.locator("#scene").getAttribute("data-simulation-elapsed"),
  };
  if (!regenerate.changed) throw new Error("Generate new situation did not change the scenario seed");
  await page.screenshot({ path:"verification-v121-briefing-upgraded-2k.png", fullPage:true });
  const score = {
    pressed: await page.locator(".scenario-briefing [data-score-toggle]").getAttribute("aria-pressed"),
    label: await page.locator(".scenario-briefing [data-score-toggle]").innerText(),
    responses: [],
  };
  const dossierButton = page.locator(".scenario-briefing [data-dossier-open]");
  await dossierButton.click();
  const dossier = {
    visible: await page.locator(".scenario-dossier.open").isVisible(),
    title: await page.locator(".dossier-paper h2").innerText(),
    sections: await page.locator(".dossier-sections section").count(),
    text: await page.locator(".dossier-paper").innerText(),
  };
  await page.screenshot({ path:"verification-v121-intelligence-dossier-2k.png", fullPage:true });
  await page.locator(".scenario-dossier [data-dossier-close]").click();
  dossier.closed = !(await page.locator(".scenario-dossier.open").isVisible());
  dossier.briefingStillVisible = await page.locator(".scenario-briefing").isVisible();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForTimeout(1_200);
  score.responses = [...audioResponses];
  const focus = page.locator(".scenario-cue [data-focus]");
  await focus.waitFor({ state:"visible", timeout:12_000 });
  const box = await focus.boundingBox();
  if (!box) throw new Error("Guidance focus button has no hit target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const longBeachRadar = await page.locator("#radar").evaluate(canvas => ({...canvas.dataset}));
  await page.locator(".radar-shell").screenshot({ path:"verification-v121-radar-long-beach.png" });
  const dismiss = page.locator(".scenario-cue [data-dismiss]");
  const titleBefore = await page.locator(".scenario-cue > b").textContent();
  await dismiss.click();
  await page.waitForTimeout(120);
  const visibleAfterDismiss = await page.locator(".scenario-cue.visible").count();
  const titleAfterDismiss = visibleAfterDismiss ? await page.locator(".scenario-cue > b").textContent() : null;
  let cg57Radar = null;
  if (visibleAfterDismiss && await page.locator(".scenario-cue [data-focus]").isVisible()) {
    await page.locator(".scenario-cue [data-focus]").click();
    await page.waitForTimeout(350);
    cg57Radar = await page.locator("#radar").evaluate(canvas => ({...canvas.dataset}));
    await page.locator(".radar-shell").screenshot({ path:"verification-v121-radar-cg57.png" });
  }
  await page.locator("#radarRange").click();
  await page.locator("#radarOrientation").click();
  await page.waitForTimeout(250);
  const radarControls = await page.locator("#radar").evaluate(canvas => ({...canvas.dataset}));
  await page.locator(".radar-shell").screenshot({ path:"verification-v121-radar-controls.png" });
  await page.locator(".scenario-phase-hud [data-runtime-mode]").selectOption("critical");
  const storedMode = await page.evaluate(() => localStorage.getItem("cwi.scenario-guidance-mode"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  const pausedBefore = Number(await page.locator("#scene").getAttribute("data-simulation-elapsed"));
  await page.waitForTimeout(500);
  const pausedAfter = Number(await page.locator("#scene").getAttribute("data-simulation-elapsed"));
  const pausedHud = (await page.locator(".scenario-phase-hud").innerText()).includes("PAUSED");
  await page.locator(".scenario-phase-hud [data-runtime-mode]").selectOption("off");
  await page.waitForTimeout(100);
  const offState = {
    stored:await page.evaluate(() => localStorage.getItem("cwi.scenario-guidance-mode")),
    cueVisible:await page.locator(".scenario-cue.visible").count(),
    hudVisible:await page.locator(".scenario-phase-hud").isVisible(),
    objectives:(await page.locator("#scene").getAttribute("data-scenario-objectives")) ?? "",
    feed:await page.locator("#feed").innerText(),
  };
  const diagnostics = await page.locator("#scene").evaluate(canvas => ({
    timeOfDay: canvas.dataset.environmentTimeOfDay,
    sunAltitude: canvas.dataset.environmentSunAltitudeDeg,
    networkObserver: canvas.dataset.networkObserver,
    networkPanelVisible: Boolean(document.querySelector(".tactical-network-panel.visible")),
    cameraViewMode: canvas.dataset.cameraViewMode,
    cameraFleetLaunchShip: canvas.dataset.cameraFleetLaunchShip,
    guidanceTask: canvas.dataset.scenarioGuidanceTask,
  }));
  await page.screenshot({ path:"verification-v121-polar-twilight-guidance.png", fullPage:true });
  console.log(JSON.stringify({ briefingMap, regenerate, score, dossier, missingControlHints, storedMode, titleBefore, titleAfterDismiss, visibleAfterDismiss, longBeachRadar, cg57Radar, radarControls, pausedBefore, pausedAfter, pausedHud, offState, diagnostics, errors }, null, 2));
  const focusApplied = diagnostics.networkObserver === "true" || diagnostics.networkPanelVisible
    || diagnostics.cameraFleetLaunchShip === "blue-cg-57" || diagnostics.cameraViewMode === "9";
  if (errors.length || score.pressed !== "true" || score.responses.length !== 6 || score.responses.some(({status}) => status !== 200) || !regenerate.changed || !regenerate.briefingVisible || !dossier.visible || !dossier.closed || !dossier.briefingStillVisible || dossier.sections < 5 || !dossier.text.includes("不要相信一张过于完整的态势图") || !briefingMap.visible || briefingMap.friendly < 4 || briefingMap.routes < 2 || briefingMap.zones < 1 || missingControlHints.length
      || /red-tu16-strike|red-tu126-orbit|red-slava|red-bomber-attack|red-ksr5-launch-corridor/i.test(briefingMap.text)
      || storedMode !== "critical" || titleAfterDismiss === titleBefore || !focusApplied
      || radarControls.radarRangeKm !== "200" || radarControls.radarOrientation !== "heading-up"
      || Math.abs(pausedAfter - pausedBefore) > 0.001 || !pausedHud
      || offState.stored !== "off" || offState.cueVisible !== 0 || !offState.hudVisible
      || !offState.objectives.includes("protect-blue-surface-group") || !offState.feed.includes("MODE-CHANGED")
      || !diagnostics.guidanceTask?.startsWith("TASK / ") || diagnostics.guidanceTask === "TASK / OBSERVE JOINT OPERATIONS"
      || diagnostics.timeOfDay !== "polar-twilight" || Number(diagnostics.sunAltitude) >= 0) process.exitCode = 1;
} finally { await browser.close(); }
