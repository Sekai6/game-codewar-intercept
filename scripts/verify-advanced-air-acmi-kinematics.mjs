import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", error => errors.push(error.message));
try {
  const url = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
  url.searchParams.set("shortAirValidation", "1");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("fighter");
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForTimeout(10_000);
  const runtime = await page.locator("#scene").evaluate(canvas => ({
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
    roles: canvas.dataset.advancedAirFormationRoles ?? "",
    perceptions: canvas.dataset.advancedAirPerceivedContacts ?? "",
    missions: canvas.dataset.airMissionStates ?? "",
    threats: canvas.dataset.advancedAirThreatStates ?? "",
  }));
  await page.getByRole("button", { name: "END EXERCISE / AAR" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "EXPORT TACVIEW" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Tacview download path unavailable");
  const acmi = await readFile(path, "utf8");
  const aircraftIds = new Set();
  const samples = new Map();
  let time = 0;
  for (const line of acmi.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      time = Number(line.slice(1));
      continue;
    }
    const id = line.split(",", 1)[0];
    if (line.includes("Type=Air+FixedWing")) aircraftIds.add(id);
    if (!aircraftIds.has(id) || !line.includes("T=")) continue;
    const transform = line.match(/(?:^|,)T=([^,]+)/)?.[1]?.split("|");
    const heading = Number(transform?.[5]);
    if (!Number.isFinite(heading)) continue;
    const list = samples.get(id) ?? [];
    list.push({ time, heading });
    samples.set(id, list);
  }
  let maximumTurnRate = 0;
  let maximumQuarterSecondChange = 0;
  let samplePairs = 0;
  for (const list of samples.values()) {
    for (let index = 1; index < list.length; index++) {
      const dt = list[index].time - list[index - 1].time;
      if (dt <= 0) continue;
      const raw = Math.abs(list[index].heading - list[index - 1].heading);
      const delta = Math.min(raw, 360 - raw);
      maximumTurnRate = Math.max(maximumTurnRate, delta / dt);
      if (dt <= 0.26) maximumQuarterSecondChange = Math.max(
        maximumQuarterSecondChange,
        delta,
      );
      samplePairs++;
    }
  }
  const result = {
    bytes: acmi.length,
    aircraft: aircraftIds.size,
    samplePairs,
    maximumTurnRate,
    maximumQuarterSecondChange,
    airLaunchEvents: acmi.split(/\r?\n/).filter(line =>
      line.includes("AIR OODA") && line.includes(" LAUNCH ")).length,
    threatResponseEvents: acmi.split(/\r?\n/).filter(line =>
      line.includes("THREAT RESPONSE")).length,
    runtime,
    minimumBeamDots: runtime.threats.split("|").filter(Boolean)
      .map(record => Number(record.split(":")[5])),
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length ||
    aircraftIds.size < 4 ||
    samplePairs < 100 ||
    maximumTurnRate > 36 ||
    maximumQuarterSecondChange > 9
    || result.threatResponseEvents < 1
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
