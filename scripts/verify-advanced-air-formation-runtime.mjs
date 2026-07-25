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
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbAdvancedAirAi").check();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const roles = document.querySelector("#scene")
      ?.dataset.advancedAirFormationRoles ?? "";
    return roles.includes("shooter") && roles.includes("F-00");
  }, null, { timeout: 30_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    roles: canvas.dataset.advancedAirFormationRoles ?? "",
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
  }));
  const records = result.roles.split("|").filter(Boolean);
  const f14 = records.filter(record => record.includes("blue-F-14A"));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  if (
    errors.length ||
    f14.length !== 2 ||
    !f14.every(record => /:(shooter|supporter|cover|defensive|rejoin|lead):C\d+:/.test(record)) ||
    !f14.some(record => record.includes(":shooter:") && record.includes("F-00"))
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
