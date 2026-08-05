import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader","--renderer-process-limit=1","--disable-background-networking"],
});
const page = await browser.newPage({ viewport:{ width:1280,height:720 } });
const errors=[];
page.on("console", message => { if(message.type()==="error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(`${process.env.APP_URL ?? "http://127.0.0.1:5173/"}?validationScenarioOffset=760`, { waitUntil:"domcontentloaded",timeout:15_000 });
  await page.locator("#sbScenario").selectOption("full-spectrum-blackout");
  await page.locator("#sbStart").click();
  await page.locator(".scenario-briefing [data-begin]").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 760, null, { timeout:15_000 });
  await page.waitForTimeout(500);
  const diagnostics=await page.locator("#scene").evaluate(canvas=>({
    elapsed:canvas.dataset.simulationElapsed,
    phase:canvas.dataset.spaceWeatherPhase,
    window:canvas.dataset.spaceWeatherCommsWindow,
    spatial:canvas.dataset.spaceWeatherSpatialStates ?? "",
  }));
  const states=diagnostics.spatial.split("|").filter(Boolean).map(value=>{
    const [id,zones,disturbance,window]=value.split(":");
    return { id,zones,disturbance:Number(disturbance?.slice(1)),window:Number(window?.slice(1)) };
  });
  const insideWindow=states.filter(state=>state.window>0);
  const outsideWindow=states.filter(state=>state.window===0);
  await page.getByRole("button", { name:"END EXERCISE / AAR" }).click();
  await page.locator("#aarEvents").waitFor({ state:"visible",timeout:5_000 });
  const aarText=await page.locator("#aarEvents").innerText();
  const aarEvidence={commsWindow:aarText.includes("COMMS WINDOW / OPEN"),propagationZone:aarText.includes("PROPAGATION ZONE")};
  console.log(JSON.stringify({diagnostics,insideWindow,outsideWindow:outsideWindow.map(value=>value.id),aarEvidence,errors},null,2));
  if(errors.length||diagnostics.phase!=="intermittent"||diagnostics.window!=="true"||!insideWindow.length||!outsideWindow.length||!aarEvidence.commsWindow||!aarEvidence.propagationZone) process.exitCode=1;
} finally { await browser.close(); }
