import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe", args:["--use-angle=swiftshader","--renderer-process-limit=1"] });
const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
const errors=[];
page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
page.on("pageerror",error=>errors.push(error.message));
try {
  const base=process.env.APP_URL??"http://127.0.0.1:5173/";
  await page.goto(`${base}${base.includes("?")?"&":"?"}shortAirValidation=1&sovietSalvoValidation=1`,{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbSovietCommandEra").selectOption("ntu-1980s");
  await page.locator("#sbSovietCommand").check();
  await page.locator("#sbRim").fill("0");await page.locator("#sbSm2").fill("0");await page.locator("#sbSm2er").fill("0");
  await page.locator("#sbStart").click();
  await page.getByRole("button",{name:"TIME: 1X"}).click();await page.getByRole("button",{name:"TIME: 2X"}).click();
  await page.keyboard.press("Shift+n");await page.keyboard.press("Shift+n");await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>{const d=document.querySelector("#scene")?.dataset;return d?.networkObserverMode==="soviet"&&Number(d.networkObserverSovietAreas)>0&&Number(d.networkObserverSovietOrders)>0&&Number(d.networkObserverSovietSalvos)>=2&&Number(d.networkObserverObjects)>5&&Number(d.aarSovietC2Events)>=4;},null,{timeout:35000});
  const result=await page.locator("#scene").evaluate(scene=>({mode:scene.dataset.networkObserverMode,nodes:Number(scene.dataset.networkObserverSovietNodes??0),commands:Number(scene.dataset.networkObserverSovietCommands??0),areas:Number(scene.dataset.networkObserverSovietAreas??0),orders:Number(scene.dataset.networkObserverSovietOrders??0),salvos:Number(scene.dataset.networkObserverSovietSalvos??0),objects:Number(scene.dataset.networkObserverObjects??0),aarEvents:Number(scene.dataset.aarSovietC2Events??0),aarAreas:Number(scene.dataset.aarSovietC2Areas??0),aarOrders:Number(scene.dataset.aarSovietC2Orders??0),aarSalvos:Number(scene.dataset.aarSovietC2Salvos??0),panel:document.querySelector(".network-observer")?.textContent??""}));
  await page.screenshot({path:"verification-soviet-c2.png"});
  await page.goto(`${base}${base.includes("?")?"&":"?"}shortAirValidation=1`,{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbPlatform").selectOption("AIRBORNE");await page.locator("#sbAirPreset").selectOption("fighter");await page.locator("#sbAirCombat").check();await page.locator("#sbSovietCommandEra").selectOption("ntu-1980s");await page.locator("#sbSovietCommand").check();await page.locator("#sbStart").click();await page.getByRole("button",{name:"TIME: 1X"}).click();await page.getByRole("button",{name:"TIME: 2X"}).click();
  await page.keyboard.press("Shift+n");await page.keyboard.press("Shift+n");await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>{const d=document.querySelector("#scene")?.dataset;return d?.networkObserverMode==="soviet"&&Number(d.networkObserverSovietCommands)>0&&Number(d.networkObserverObjects)>3;},null,{timeout:25000});
  const gci=await page.locator("#scene").evaluate(scene=>({commands:Number(scene.dataset.networkObserverSovietCommands??0),objects:Number(scene.dataset.networkObserverObjects??0),panel:document.querySelector(".network-observer")?.textContent??""}));
  await page.screenshot({path:"verification-soviet-gci-c2.png"});
  console.log(JSON.stringify({maritime:result,gci,errors},null,2));
  if(errors.length||result.mode!=="soviet"||result.nodes<2||result.areas<1||result.orders<1||result.salvos<2||result.objects<6||result.aarEvents<4||result.aarAreas<1||result.aarOrders<1||result.aarSalvos<2||!result.panel.includes("SOVIET C2")||!result.panel.includes("CUE ONLY - NO WEAPON AUTHORITY")||!result.panel.includes("SOVIET FLEET-COMMAND")||result.panel.includes("LINK11 TRANSMIT")||gci.commands<1||gci.objects<4||!gci.panel.includes("SOVIET GCI"))process.exitCode=1;
} finally { await browser.close(); }
