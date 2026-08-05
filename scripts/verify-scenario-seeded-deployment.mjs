import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport:{ width:960, height:540 } });
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil:"domcontentloaded", timeout:15_000 });
  const result = await page.evaluate(async () => {
    const { compileScenario } = await import("/src/scenario-system/compiler.ts");
    const source = await fetch("/src/scenarios/full-spectrum-blackout/scenario.json").then(response => response.json());
    const first = compileScenario(source);
    const repeat = compileScenario(structuredClone(source));
    const alternate = compileScenario({ ...structuredClone(source), simulation:{ ...source.simulation, seed:source.simulation.seed + 1 } });
    const leader = (scenario, formationId) => scenario.airSpawns.find(spawn => spawn.formationId === formationId && spawn.formationIndex === 0);
    const tuple = spawn => [spawn.position.x, spawn.position.y, spawn.position.z];
    const summary = scenario => Object.fromEntries(["red-tu16-strike", "red-mig29-escort", "red-tu126-orbit"].map(id => {
      const spawn = leader(scenario, id);
      return [id, { position:tuple(spawn), routeStart:tuple({ position:spawn.scenarioRoute[0] }) }];
    }));
    return { seed:source.simulation.seed, estimate:source.zones.find(zone => zone.id === "red-air-threat-estimate"), first:summary(first), repeat:summary(repeat), alternate:summary(alternate) };
  });
  assert.deepEqual(result.first, result.repeat, "same seed must reproduce every deployment");
  assert.notDeepEqual(result.first["red-tu16-strike"].position, result.alternate["red-tu16-strike"].position, "different seeds must change the raid deployment");
  const horizontalDistance = (left, right) => Math.hypot(left[0] - right[0], left[2] - right[2]);
  for (const id of ["red-tu16-strike", "red-mig29-escort", "red-tu126-orbit"])
    assert(horizontalDistance(result.first[id].position, result.first[id].routeStart) < .001, `${id} route must begin at its deployment point`);
  for (const id of ["red-tu16-strike", "red-mig29-escort"])
    assert(horizontalDistance(result.first[id].position, result.estimate.center) < result.estimate.radius, `${id} must remain inside the intelligence estimate`);
  assert(horizontalDistance(result.first["red-tu16-strike"].position, result.first["red-mig29-escort"].position) < 320, "escort must remain associated with the bomber package");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
