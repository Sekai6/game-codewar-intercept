import { chromium } from "playwright-core";

const defaultChromePath = process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? defaultChromePath,
  args: [
    "--use-angle=swiftshader",
    "--renderer-process-limit=1",
    "--disable-background-networking",
  ],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#scene").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#sbStart").click();
  await page.waitForFunction(
    () => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) > 0.1,
    null,
    { timeout: 12_000 },
  );
  const result = await page.locator("#scene").evaluate((canvas) => ({
    elapsed: Number(canvas.dataset.simulationElapsed ?? 0),
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  }));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  if (errors.length || result.elapsed <= 0.1 || result.width < 1 || result.height < 1)
    process.exitCode = 1;
} finally {
  await browser.close();
}
