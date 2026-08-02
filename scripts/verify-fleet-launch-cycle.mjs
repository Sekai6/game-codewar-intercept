import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], messages = [];
page.on("console", (message) => {
  messages.push(message.text());
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));
try {
  const rawUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  await page.goto(`${rawUrl}${rawUrl.includes("?") ? "&" : "?"}shortAirValidation=1`, {
    waitUntil: "domcontentloaded", timeout: 15_000,
  });
  await page.locator("#sbFleetMode").check();
  await page.locator("#sbStart").click();
  await page.waitForFunction(() =>
    (document.querySelector("#scene")?.dataset.fleetSamMagazines ?? "").includes("blue-cg-57:"),
  null, { timeout: 15_000 });
  const initialMagazines = await page.locator("#scene").evaluate((canvas) =>
    canvas.dataset.fleetSamMagazines ?? "");
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    return (canvas?.dataset.fleetPhysicalLaunches ?? "").includes("blue-cg-57:blue-cg-57 MK 41")
      && (canvas?.dataset.fleetEngagements ?? "").includes(":weapons-away:");
  }, null, { timeout: 55_000 });
  await page.keyboard.press("l");
  await page.waitForFunction(() =>
    document.querySelector("#scene")?.dataset.cameraFleetLaunchShip === "blue-cg-57",
  null, { timeout: 5_000 });
  // The fleet launch camera uses interpolation; capture only after it has
  // settled on the firing ship, otherwise the screenshot can still show the
  // flagship even though the physical launch belongs to the escort.
  await page.waitForTimeout(2200);
  const result = await page.locator("#scene").evaluate((canvas) => ({
    assignments: canvas.dataset.fleetAawAssignments,
    engagements: canvas.dataset.fleetEngagements,
    localEngagements: canvas.dataset.fleetLocalEngagements,
    magazines: canvas.dataset.fleetSamMagazines,
    launcherPending: canvas.dataset.fleetLauncherPending,
    physicalLaunches: canvas.dataset.fleetPhysicalLaunches,
    launchCameraShip: canvas.dataset.cameraFleetLaunchShip,
    launchHud: [
      document.querySelector("#shipBadge")?.textContent,
      document.querySelector("#shipName")?.textContent,
      document.querySelector("#shipState")?.textContent,
    ].join(" / "),
  }));
  const offsets = (result.physicalLaunches ?? "").split("|").map((entry) =>
    Number(entry.match(/OFFSET=([\d.-]+)/)?.[1] ?? Number.POSITIVE_INFINITY));
  result.noBypassEvent = !messages.some((message) => message.includes("SHIP SAM AUTO LAUNCH"));
  result.originsOwnedByCg57 = offsets.length > 0 && offsets.every((offset) => offset < 80);
  const magazineTotal = (value, shipId) => {
    const entry = value.split("|").find((candidate) => candidate.startsWith(`${shipId}:`)) ?? "";
    return [...entry.matchAll(/(?:RIM|MR|ER)=(\d+)/g)]
      .reduce((total, match) => total + Number(match[1]), 0);
  };
  result.initialMagazines = initialMagazines;
  result.cg57RoundsSpent = magazineTotal(initialMagazines, "blue-cg-57")
    - magazineTotal(result.magazines ?? "", "blue-cg-57");
  result.errors = errors;
  await page.screenshot({ path: "verification-fleet-launch-cycle.png", fullPage: true });
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || !result.noBypassEvent || !result.originsOwnedByCg57
      || !result.assignments?.includes("blue-cg-57")
      || result.launchCameraShip !== "blue-cg-57"
      || !result.launchHud.includes("CG-57 / USS LAKE CHAMPLAIN")
      || !result.launchHud.includes("MK 41")
      || !result.launchHud.includes("ORGANIC LAUNCH")
      || !result.engagements?.includes(":weapons-away:")
      || result.cg57RoundsSpent !== 2
      || !result.physicalLaunches?.includes("MK 41")
      || !result.physicalLaunches?.includes("CELL")) process.exitCode = 1;
} finally {
  await browser.close();
}
