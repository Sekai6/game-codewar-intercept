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
  await page.locator("#sbAdvancedAirAi").uncheck();
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() =>
    Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) > 0,
  );
  await page.waitForTimeout(500);
  const disabled = await page.locator("#scene").evaluate(canvas => ({
    updates: Number(canvas.dataset.advancedAirPerceptionUpdates ?? -1),
    contacts: canvas.dataset.advancedAirPerceivedContacts ?? "",
  }));
  await page.locator("#sbAdvancedAirAi").evaluate(input => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return Number(canvas?.dataset.advancedAirPerceptionUpdates ?? 0) > 0 &&
      (canvas?.dataset.advancedAirPerceivedContacts ?? "").includes("P-00");
  }, null, { timeout: 12_000 });
  const enabled = await page.locator("#scene").evaluate(canvas => ({
    updates: Number(canvas.dataset.advancedAirPerceptionUpdates ?? 0),
    contacts: canvas.dataset.advancedAirPerceivedContacts ?? "",
  }));
  console.log(JSON.stringify({ disabled, enabled, errors }, null, 2));
  if (
    errors.length ||
    disabled.updates !== 0 ||
    disabled.contacts !== "" ||
    enabled.updates <= 0 ||
    !enabled.contacts.includes("P-00") ||
    enabled.contacts.includes("air-") ||
    enabled.contacts.includes("targetId")
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
