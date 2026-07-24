import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  BoxGeometry,
  Clock,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Points,
  PointsNodeMaterial,
  StorageBufferAttribute,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { Fn, If, cameraPosition, color, cross, dot, float, fract, instanceIndex, mix, mul, normalWorld, normalize, positionLocal, positionWorld, positionWorldDirection, pow, smoothstep, storage, texture, time, uniform, vec2, vec3 } from "three/tsl";
import { TiledLighting } from "three/addons/lighting/TiledLighting.js";
import { createWebGpuOceanSpectrum } from "./webgpu-ocean-spectrum";
import { createWebGpuAtmosphereLuts } from "./webgpu-atmosphere-luts";

class StableTiledLighting extends TiledLighting {
  createNode(lights: any[] = []) {
    const node = super.createNode(lights) as any;
    const originalCacheKey = node.customCacheKey.bind(node);
    node.customCacheKey = () => node._compute ? originalCacheKey() : `tiled-init-${node.maxLights}-${node.tileSize}`;
    return node;
  }
}

const canvas = document.querySelector("#webgpu-lab") as HTMLCanvasElement;
const status = document.querySelector("#status") as HTMLElement;
const scene = new Scene();
const sunDirection = uniform(new Vector3(-0.707, 0.469, -0.526).normalize());
const camera = new PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 500);
camera.position.set(28, 20, 34);
camera.lookAt(0, 4, 0);
const renderer = new WebGPURenderer({ canvas, antialias: true });
renderer.lighting = new StableTiledLighting();
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
await renderer.init();

const device = (renderer.backend as any).device;
if (!device) throw new Error("The native WebGPU backend did not expose its device");
const [fftSpectrum, atmosphereLuts] = await Promise.all([
  createWebGpuOceanSpectrum(device),
  createWebGpuAtmosphereLuts(device),
]);
const fftAtlas = texture(fftSpectrum.texture);
const transmittanceLut = texture(atmosphereLuts.transmittance);
const singleScatteringLut = texture(atmosphereLuts.singleScattering);
const multipleScatteringLut = texture(atmosphereLuts.multipleScattering);

scene.backgroundNode = Fn(() => {
  const direction = normalize(positionWorldDirection);
  const viewMu = direction.y.clamp(-0.08, 1);
  const sunMu = sunDirection.y.clamp(-0.18, 1);
  const scatterUv = vec2(sunMu.add(0.18).div(1.18), viewMu.add(0.08).div(1.08));
  const transmittance = transmittanceLut.sample(vec2(viewMu.add(0.12).div(1.12).clamp(0, 1), 0.045)).rgb;
  const singleScatter = singleScatteringLut.sample(scatterUv).rgb;
  const multipleScatter = multipleScatteringLut.sample(scatterUv).rgb;
  const altitude = direction.y.mul(0.5).add(0.5).clamp(0, 1);
  const horizonToZenith = smoothstep(0.04, 0.82, altitude);
  const clearSky = mix(color(0x91aebc), color(0x174b85), horizonToZenith);
  const brunetonScatter = singleScatter.mul(1.7).add(multipleScatter.mul(1.15));
  const sunAmount = dot(direction, sunDirection).max(0);
  const mieHalo = pow(sunAmount, 42).mul(color(0xffbd78)).mul(0.45);
  const sunDisk = smoothstep(0.99972, 0.99991, sunAmount).mul(color(0xffe0ad)).mul(3.4);
  return clearSky.mul(transmittance.mul(0.2).add(0.82)).add(brunetonScatter).add(mieHalo).add(sunDisk);
})();

scene.add(new AmbientLight(0x6f91a8, 1.2));
const sun = new DirectionalLight(0xffd29b, 2.2);
sun.position.set(-20, 30, 18);
scene.add(sun);
const localLights: PointLight[] = [];
for (let index = 0; index < 24; index++) {
  const warm = index % 5 < 2;
  const light = new PointLight(warm ? 0xff6a28 : 0x55bfff, warm ? 2.4 : 1.25, warm ? 9 : 6);
  light.position.set(Math.sin(index * 2.17) * (9 + index % 7), 4.5 + (index % 5) * 2.3, Math.cos(index * 1.73) * (8 + index % 9));
  localLights.push(light);
  scene.add(light);
}

const hullMaterial = new MeshStandardNodeMaterial({ color: 0x68777c, metalness: 0.35, roughness: 0.42 });
const hull = new Mesh(new BoxGeometry(22, 3.5, 7), hullMaterial);
hull.position.y = 4;
hull.rotation.y = -0.18;
scene.add(hull);
const deck = new Mesh(new BoxGeometry(9, 5, 5), new MeshStandardNodeMaterial({ color: 0x839094, metalness: 0.25, roughness: 0.5 }));
deck.position.set(-2, 7, 0);
hull.add(deck);
const seaMaterial = new MeshStandardNodeMaterial({ metalness: 0.38, roughness: 0.24 });
const splashOrigin = vec2(18, -12);
const wavePosition = Fn(() => {
  const p = positionLocal.toVar();
  const x = p.x;
  const z = p.y;
  const fftUv = fract(vec2(x, z).div(420).add(0.5));
  const atlasFrame = fract(time.mul(0.7).div(16)).mul(16);
  const frame0 = atlasFrame.floor();
  const frame1 = frame0.add(1).mod(16);
  const frameBlend = fract(atlasFrame);
  const spectral0 = fftAtlas.sample(vec2(fftUv.x, frame0.add(fftUv.y).div(16)));
  const spectral1 = fftAtlas.sample(vec2(fftUv.x, frame1.add(fftUv.y).div(16)));
  const spectral = mix(spectral0, spectral1, frameBlend);
  const displacement = spectral.rgb.mul(2).sub(1);
  const phaseA = x.mul(0.105).add(z.mul(0.041)).add(time.mul(0.72));
  const phaseB = x.mul(-0.074).add(z.mul(0.162)).add(time.mul(1.08));
  const phaseC = x.mul(0.31).add(z.mul(-0.19)).add(time.mul(1.74));
  const residualHeight = phaseA.sin().mul(0.16).add(phaseB.sin().mul(0.08)).add(phaseC.sin().mul(0.025));
  const shipX = x.mul(0.984).sub(z.mul(0.179));
  const shipZ = x.mul(0.179).add(z.mul(0.984));
  const aftDistance = shipX.add(11).max(0);
  const wakeEnvelope = smoothstep(0, 7, aftDistance).mul(float(1).sub(smoothstep(24, 62, aftDistance)));
  const wakeCenter = float(1).sub(smoothstep(0.55, 3.2, shipZ.abs())).mul(wakeEnvelope);
  const kelvinArmDistance = shipZ.abs().sub(aftDistance.mul(0.27)).abs();
  const kelvinArms = float(1).sub(smoothstep(0.12, 0.62, kelvinArmDistance)).mul(wakeEnvelope);
  const wakeHeight = z.mul(1.8).add(aftDistance.mul(0.72)).add(time.mul(4.1)).sin().mul(wakeCenter.mul(0.18).add(kelvinArms.mul(0.27)));
  const bowEnvelope = float(1).sub(smoothstep(0, 8, shipX.add(11).abs())).mul(float(1).sub(smoothstep(1.2, 6, shipZ.abs())));
  const bowWave = shipZ.abs().mul(1.25).sub(shipX.add(11).mul(0.45)).add(time.mul(2.2)).sin().mul(bowEnvelope).mul(0.11);
  const splashAge = fract(time.div(7.5));
  const splashRadius = splashAge.mul(22).add(0.8);
  const splashDelta = vec2(x, z).sub(splashOrigin);
  const splashDistance = splashDelta.length();
  const angularBreakup = splashDelta.x.mul(0.93).add(splashDelta.y.mul(1.47)).add(time.mul(0.8)).sin().mul(0.5).add(0.5);
  const splashRing = float(1).sub(smoothstep(0.12, 0.68, splashDistance.sub(splashRadius).abs())).mul(float(1).sub(splashAge)).mul(angularBreakup.mul(0.55).add(0.25)).mul(0.22);
  return vec3(x.add(displacement.x.mul(1.15)), z.add(displacement.y.mul(1.15)), residualHeight.add(displacement.z.mul(0.74)).add(wakeHeight).add(bowWave).add(splashRing));
})();
seaMaterial.positionNode = wavePosition;
seaMaterial.normalNode = Fn(() => {
  const p = positionLocal;
  const epsilon = float(2.4);
  const fftUv = fract(vec2(p.x, p.y).div(420).add(0.5));
  const atlasFrame = fract(time.mul(0.7).div(16)).mul(16).floor();
  const sampleHeight = (offsetX: any, offsetY: any) => fftAtlas.sample(vec2(fract(fftUv.x.add(offsetX.div(420))), atlasFrame.add(fract(fftUv.y.add(offsetY.div(420)))).div(16))).b.mul(2).sub(1).mul(0.74);
  const dx = sampleHeight(epsilon, float(0)).sub(sampleHeight(epsilon.negate(), float(0))).div(epsilon.mul(2));
  const dz = sampleHeight(float(0), epsilon).sub(sampleHeight(float(0), epsilon.negate())).div(epsilon.mul(2));
  return normalize(cross(vec3(1, 0, dx), vec3(0, 1, dz)));
})();
seaMaterial.colorNode = Fn(() => {
  const distance = cameraPosition.distance(positionWorld);
  const viewDirection = normalize(cameraPosition.sub(positionWorld));
  const facing = dot(normalWorld, viewDirection).max(0);
  const fresnel = float(0.035).add(float(0.965).mul(pow(float(1).sub(facing), 5)));
  const water = mix(color(0x082c3e), color(0x1b6b7e), facing.mul(0.32));
  const environmentReflection = mix(color(0x7798a8), color(0x244c70), normalWorld.y.clamp(0, 1)).mul(fresnel.mul(0.72));
  const fftUv = fract(vec2(positionLocal.x, positionLocal.y).div(420).add(0.5));
  const atlasFrame = fract(time.mul(0.7).div(16)).mul(16).floor();
  const jacobianFoam = fftAtlas.sample(vec2(fftUv.x, atlasFrame.add(fftUv.y).div(16))).a;
  const shipX = positionLocal.x.mul(0.984).sub(positionLocal.y.mul(0.179));
  const shipZ = positionLocal.x.mul(0.179).add(positionLocal.y.mul(0.984));
  const aftDistance = shipX.add(11).max(0);
  const wakeEnvelope = smoothstep(0, 7, aftDistance).mul(float(1).sub(smoothstep(24, 62, aftDistance)));
  const wakeCenter = float(1).sub(smoothstep(0.35, 2.8, shipZ.abs())).mul(wakeEnvelope);
  const kelvinArmDistance = shipZ.abs().sub(aftDistance.mul(0.27)).abs();
  const kelvinArms = float(1).sub(smoothstep(0.1, 0.58, kelvinArmDistance)).mul(wakeEnvelope);
  const bowFoam = float(1).sub(smoothstep(0, 6.5, shipX.add(11).abs())).mul(float(1).sub(smoothstep(0.8, 5.2, shipZ.abs())));
  const breakup = positionLocal.x.mul(1.37).add(positionLocal.y.mul(2.11)).add(time.mul(1.8)).sin().mul(0.5).add(0.5);
  const splashAge = fract(time.div(7.5));
  const splashRadius = splashAge.mul(22).add(0.8);
  const splashDelta = vec2(positionLocal.x, positionLocal.y).sub(splashOrigin);
  const splashDistance = splashDelta.length();
  const angularBreakup = splashDelta.x.mul(0.93).add(splashDelta.y.mul(1.47)).add(time.mul(0.8)).sin().mul(0.5).add(0.5);
  const primaryRing = float(1).sub(smoothstep(0.12, 0.72, splashDistance.sub(splashRadius).abs()));
  const secondaryRing = float(1).sub(smoothstep(0.2, 0.9, splashDistance.sub(splashRadius.mul(0.72)).abs())).mul(0.32);
  const splashFoam = primaryRing.add(secondaryRing).mul(float(1).sub(splashAge)).mul(angularBreakup.mul(0.7).add(0.12)).mul(0.14);
  const foam = smoothstep(0.14, 0.48, jacobianFoam).mul(0.28).add(wakeCenter.mul(0.14)).add(kelvinArms.mul(0.2).mul(breakup.mul(0.45).add(0.55))).add(bowFoam.mul(0.16)).add(splashFoam);
  const crest = foam.clamp(0, 0.42).mul(color(0xb7d6dc));
  const aerial = smoothstep(55, 170, distance);
  return mix(water.add(environmentReflection).add(crest), color(0x6f8997), aerial.mul(0.2));
})();
seaMaterial.emissiveNode = mul(seaMaterial.colorNode, 0.26);
const sea = new Mesh(new PlaneGeometry(420, 420, 256, 256), seaMaterial);
sea.rotation.x = -Math.PI / 2;
scene.add(sea);

const particleCount = 32768;
const positionAttribute = new StorageBufferAttribute(particleCount, 3);
const velocityAttribute = new StorageBufferAttribute(particleCount, 3);
const ageAttribute = new StorageBufferAttribute(particleCount, 1);
const positions = storage(positionAttribute, "vec3", particleCount);
const velocities = storage(velocityAttribute, "vec3", particleCount);
const ages = storage(ageAttribute, "float", particleCount);
const deltaTime = uniform(1 / 60);
const initializeParticles = Fn(() => {
  const index = float(instanceIndex);
  const angle = index.mul(2.399963).mod(6.283185);
  const spread = fract(index.mul(0.618034)).pow(1.7);
  const phase = fract(index.mul(0.754877));
  const launchSpeed = mix(float(6.5), float(12), fract(index.mul(0.414214)));
  const radialSpeed = mix(float(0.45), float(3.8), spread);
  const age = phase.mul(1.45);
  const initialVelocity = vec3(angle.cos().mul(radialSpeed), launchSpeed, angle.sin().mul(radialSpeed));
  positions.element(instanceIndex).assign(vec3(18, 0.12, -12).add(initialVelocity.mul(age)).add(vec3(0, age.mul(age).mul(-4.9), 0)));
  velocities.element(instanceIndex).assign(initialVelocity.add(vec3(0, age.mul(-9.8), 0)));
  ages.element(instanceIndex).assign(age);
})().compute(particleCount);
const updateParticles = Fn(() => {
  const position = positions.element(instanceIndex);
  const velocity = velocities.element(instanceIndex);
  const age = ages.element(instanceIndex);
  const index = float(instanceIndex);
  age.addAssign(deltaTime);
  velocity.y.subAssign(deltaTime.mul(9.8));
  velocity.x.mulAssign(float(1).sub(deltaTime.mul(0.16)));
  velocity.z.mulAssign(float(1).sub(deltaTime.mul(0.16)));
  position.addAssign(velocity.mul(deltaTime));
  If(age.greaterThan(1.55), () => {
    const angle = index.mul(2.399963).add(time.mul(0.21)).mod(6.283185);
    const spread = fract(index.mul(0.618034)).pow(1.7);
    const radialSpeed = mix(float(0.45), float(3.8), spread);
    const launchSpeed = mix(float(6.5), float(12), fract(index.mul(0.414214)));
    position.assign(vec3(18, 0.12, -12));
    velocity.assign(vec3(angle.cos().mul(radialSpeed), launchSpeed, angle.sin().mul(radialSpeed)));
    age.assign(0);
  });
})().compute(particleCount);
const particleGeometry = new BufferGeometry();
particleGeometry.setAttribute("position", positionAttribute);
particleGeometry.setDrawRange(0, particleCount);
const particleMaterial = new PointsNodeMaterial({ transparent: true, depthWrite: false, size: 2.15, sizeAttenuation: true });
particleMaterial.colorNode = mix(color(0x78aebc), color(0xf4ffff), smoothstep(0.1, 8, positionLocal.y));
particleMaterial.opacityNode = smoothstep(0.02, 0.45, positionLocal.y).mul(float(1).sub(smoothstep(5.5, 8.5, positionLocal.y))).mul(0.64);
const particles = new Points(particleGeometry, particleMaterial);
particles.frustumCulled = false;
scene.add(particles);
await renderer.computeAsync(initializeParticles);

canvas.dataset.backend = renderer.backend.constructor.name === "WebGPUBackend" ? "WEBGPU" : "FALLBACK";
canvas.dataset.pbr = "MESH_STANDARD_NODE";
canvas.dataset.tiledLights = "24";
canvas.dataset.storageParticles = String(particleCount);
canvas.dataset.storageParticleRole = "EVENT_SPLASH_WATER_COLUMN";
canvas.dataset.storageParticlePath = "COMPUTE_TO_POINTS_ZERO_READBACK";
canvas.dataset.depthOcclusion = "SHARED_RENDERER_DEPTH";
canvas.dataset.tslOcean = "FFT_JACOBIAN_KELVIN_WAKE_SPLASH_RING";
canvas.dataset.splashInput = "LOCAL_EVENT_DISPLACEMENT_FOAM";
canvas.dataset.fftOceanResource = `GPU_COMPUTE_READBACK_UPLOAD_${fftSpectrum.frames}X${fftSpectrum.resolution}`;
canvas.dataset.tslSky = "BRUNETON_3_LUT_AFTERNOON";
canvas.dataset.brunetonResource = `${atmosphereLuts.backend}_READBACK_UPLOAD`;
status.textContent = `WEBGPU NATIVE\nFFT OCEAN + BRUNETON SKY\nSTORAGE PARTICLES ${particleCount}`;
const clock = new Clock();
let renderedFrames = 0;
async function frame() {
  deltaTime.value = Math.min(clock.getDelta(), 0.05);
  localLights.forEach((light, index) => {
    const base = index % 5 < 2 ? 2.1 : 1.05;
    light.intensity = base + Math.sin(performance.now() * 0.002 + index * 1.37) * base * 0.22;
  });
  renderer.compute(updateParticles);
  renderer.render(scene, camera);
  renderedFrames++;
  canvas.dataset.renderedFrames = String(renderedFrames);
  canvas.dataset.drawCalls = String(renderer.info.render.calls);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
