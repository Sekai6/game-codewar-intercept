import { chromium } from "playwright-core";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--renderer-process-limit=1"]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(process.env.APP_URL??"http://127.0.0.1:5173/",{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("aew");
  await page.locator("#sbDatalinkEra").selectOption("ntu-baseline");
  await page.locator("#sbSovietCommand").uncheck();
  await page.locator("#sbStart").click();
  await page.getByRole("button",{name:"TIME: 1X"}).click();
  await page.getByRole("button",{name:"TIME: 2X"}).click();
  await page.waitForFunction(()=>{
    const data=document.querySelector("#scene")?.dataset,commands=data?.aewCommandStates??"";
    return commands.includes(":link4a:")&&commands.includes(":voice-gci:")&&Number(data?.link11Transmitted??0)>0;
  },null,{timeout:30000});
  const result=await page.locator("#scene").evaluate(scene=>({aircraft:Number(scene.dataset.aircraftTotal??0),missions:scene.dataset.airMissionStates??"",commands:scene.dataset.aewCommandStates??"",events:scene.dataset.aewEventLog??"",link11Participants:scene.dataset.link11Participants??"",link11Transmitted:Number(scene.dataset.link11Transmitted??0),link11Delivered:Number(scene.dataset.link11Delivered??0),aarCommands:Number(scene.dataset.aarAewCommandCount??0),launches:scene.dataset.airWeaponLaunchLog??""}));
  console.log(JSON.stringify({...result,errors},null,2));
  const commandParts=result.commands.split("|");
  if(errors.length||result.aircraft!==6||!result.missions.includes("blue-E-2C")||!result.missions.includes("red-TU-126")||!result.link11Participants.includes("blue-E-2C")||result.link11Transmitted<1||result.aarCommands<1||!result.events.includes("E-2C Hawkeye DETECT")||!result.events.includes("Tu-126 Moss DETECT")||commandParts.filter(value=>value.includes(":link4a:AEW-")).length>2||commandParts.filter(value=>value.includes(":voice-gci:AEW-")).length!==1||result.commands.includes("blue-F-14A-2:blue-E-2C-1:link4a:blue-")||/E-2C Hawkeye LAUNCH|Tu-126 Moss LAUNCH/.test(result.launches))process.exitCode=1;
}finally{await browser.close();}
