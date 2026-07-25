import { chromium } from "playwright-core";

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--disable-gpu-sandbox","--renderer-process-limit=1"]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];
  page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text());});page.on("pageerror",(error)=>errors.push(error.message));
  await page.route("**/__ship-interceptor-gallery",(route)=>route.fulfill({contentType:"text/html",body:`<!doctype html><html><body style="margin:0;overflow:hidden;background:#06131b"><canvas id="gallery"></canvas><script type="module">
    import * as THREE from '/node_modules/.vite/deps/three.js';import {createShipInterceptorModel} from '/src/models/ship-interceptors.ts';
    const canvas=document.querySelector('#gallery'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x071923);const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.05,100);scene.add(new THREE.HemisphereLight(0xa8d5e7,0x17252b,2.2));const key=new THREE.DirectionalLight(0xffdfb0,4);key.position.set(-4,6,5);scene.add(key);const rim=new THREE.DirectionalLight(0x4f9fd1,2.3);rim.position.set(5,0,-4);scene.add(rim);let model;
    window.showInterceptor=(weapon)=>{if(model)scene.remove(model);model=createShipInterceptorModel(weapon);model.rotation.set(.08,0,-Math.PI*.5);model.userData.booster.visible=true;scene.add(model);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.72;camera.position.copy(center).add(new THREE.Vector3(radius*.8,radius*.55,radius*1.65));camera.lookAt(center);camera.updateProjectionMatrix();document.body.dataset.weapon=weapon;renderer.render(scene,camera);};window.showInterceptor('RIM-67');
  </script></body></html>`}));
  const base=(process.env.APP_URL??"http://127.0.0.1:5173").replace(/\/$/,"");await page.goto(`${base}/__ship-interceptor-gallery`,{waitUntil:"domcontentloaded",timeout:15000});await page.waitForFunction(()=>document.body.dataset.weapon==="RIM-67");const captured=[];
  for(const weapon of ["RIM-67","SM-2MR","SM-2ER"]){await page.evaluate((id)=>window.showInterceptor(id),weapon);await page.waitForTimeout(120);await page.locator("#gallery").screenshot({path:`verification-ship-interceptor-${weapon.toLowerCase()}-ultra.png`});captured.push(weapon);}
  console.log(JSON.stringify({captured,errors},null,2));if(captured.length!==3||errors.length)process.exitCode=1;
}finally{await browser.close();}
