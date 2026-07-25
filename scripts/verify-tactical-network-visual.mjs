import { chromium } from "playwright-core";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1"]});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(`${process.env.APP_URL??"http://127.0.0.1:5173/"}?shortAirValidation=1`,{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbDatalinkEra").selectOption("link16-modernized");
  await page.locator("#sbLink16").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button",{name:"TIME: 1X"}).click();
  await page.getByRole("button",{name:"TIME: 2X"}).click();
  await page.keyboard.press("n");
  await page.waitForFunction(()=>{const d=document.querySelector("#scene")?.dataset;return d?.networkObserver==="true"&&d.networkObserverMode==="all"&&Number(d.networkObserverNodes)>2&&Number(d.networkObserverTracks)>0&&Number(d.networkObserverActivities)>0&&Number(d.networkObserverObjects)>2;},null,{timeout:30000});
  const panel=page.locator(".network-observer");
  const all=await page.locator("#scene").evaluate(canvas=>({...canvas.dataset,panelText:document.querySelector(".network-observer")?.textContent??""}));
  await page.screenshot({path:"verification-tactical-network.png"});
  await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>document.querySelector("#scene")?.dataset.networkObserverMode==="off");
  await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>document.querySelector("#scene")?.dataset.networkObserverMode==="link11");
  await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>document.querySelector("#scene")?.dataset.networkObserverMode==="link16");
  const finalMode=await page.locator("#scene").getAttribute("data-network-observer-mode");
  await page.goto(`${process.env.APP_URL??"http://127.0.0.1:5173/"}?shortAirValidation=1`,{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbAirCombat").check();await page.locator("#sbDatalinkEra").selectOption("ntu-baseline");await page.locator("#sbStart").click();
  await page.keyboard.press("Shift+n");
  await page.waitForFunction(()=>{const d=document.querySelector("#scene")?.dataset;return d?.networkObserverMode==="link11"&&d.link11Ncs==="blue-surface-ship"&&Number(d.link11RollCalls)>0&&Number(d.networkObserverObjects)>0;},null,{timeout:15000});
  const link11=await page.locator("#scene").evaluate(canvas=>({...canvas.dataset,panelText:document.querySelector(".network-observer")?.textContent??""}));
  await page.screenshot({path:"verification-tactical-network-link11.png"});
  console.log(JSON.stringify({nodes:Number(all.networkObserverNodes),tracks:Number(all.networkObserverTracks),activities:Number(all.networkObserverActivities),objects:Number(all.networkObserverObjects),panelText:all.panelText,finalMode,link11:{ncs:link11.link11Ncs,rollCalls:Number(link11.link11RollCalls),objects:Number(link11.networkObserverObjects),panelText:link11.panelText},errors},null,2));
  if(errors.length||!all.panelText.includes("CUE ONLY - NO WEAPON AUTHORITY")||!all.panelText.includes("LINK 16")||finalMode!=="link16"||link11.link11Ncs!=="blue-surface-ship"||!link11.panelText.includes("NTU-BASELINE / LINK11")||!(await panel.isVisible()))process.exitCode=1;
}finally{await browser.close();}
