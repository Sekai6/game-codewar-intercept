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
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForTimeout(12_000);
  const result = await page.locator("#scene").evaluate(canvas => ({
    threats: canvas.dataset.advancedAirThreatStates ?? "",
    maneuvers: canvas.dataset.advancedAirManeuverLog ?? "",
    countermeasures: canvas.dataset.airCountermeasureEventLog ?? "",
  }));
  const maximumRates = result.threats.split("|").filter(Boolean)
    .map(record => Number(record.split(":")[3]));
  console.log(JSON.stringify({ ...result, maximumRates, errors }, null, 2));
  if (
    errors.length ||
    maximumRates.length < 4 ||
    maximumRates.some(rate => !Number.isFinite(rate) || rate > 36)
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
