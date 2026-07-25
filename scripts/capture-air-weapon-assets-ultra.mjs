import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--disable-gpu-sandbox", "--renderer-process-limit=1"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__air-weapon-gallery", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body style="margin:0;overflow:hidden;background:#06131b"><canvas id="gallery"></canvas><script type="module">
      import * as THREE from '/node_modules/.vite/deps/three.js';
      import { createAirWeaponModel } from '/src/models/air-weapons.ts';
      const definitions={
        'AIM-54A':'active-radar','AIM-7F':'semi-active-radar','AIM-9L':'infrared',
        'R-27R':'semi-active-radar','R-73':'infrared','KSR-5':'anti-ship-radar','AGM-84A':'anti-ship-radar'
      };
      const canvas=document.querySelector('#gallery'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
      renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x071923);
      const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.05,100);
      scene.add(new THREE.HemisphereLight(0x9fcbe0,0x15232a,2.2));
      const key=new THREE.DirectionalLight(0xffe1b2,4.2);key.position.set(-4,6,5);scene.add(key);
      const rim=new THREE.DirectionalLight(0x58a7d6,2.4);rim.position.set(5,1,-4);scene.add(rim);
      let model=null;
      window.showWeapon=(id)=>{
        if(model)scene.remove(model);model=createAirWeaponModel({id,guidance:definitions[id]});scene.add(model);
        model.rotation.set(-.12,-.72,.04);model.userData.flame.visible=false;
        const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.72;
        camera.position.copy(center).add(new THREE.Vector3(radius*1.1,radius*.56,radius*1.55));camera.lookAt(center);camera.near=.01;camera.far=100;camera.updateProjectionMatrix();
        document.body.dataset.weapon=id;renderer.render(scene,camera);
      };
      window.showWeapon('AIM-54A');
    </script></body></html>`,
  }));
  const baseUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
  await page.goto(`${baseUrl}/__air-weapon-gallery`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(() => document.body.dataset.weapon === "AIM-54A");
  const captured = [];
  for (const id of ["AIM-54A", "AIM-7F", "AIM-9L", "R-27R", "R-73", "KSR-5", "AGM-84A"]) {
    await page.evaluate((weaponId) => window.showWeapon(weaponId), id);
    await page.waitForTimeout(120);
    await page.locator("#gallery").screenshot({ path: `verification-air-weapon-${id.toLowerCase()}.png` });
    captured.push(id);
  }
  console.log(JSON.stringify({ captured, errors }, null, 2));
  if (captured.length !== 7 || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
