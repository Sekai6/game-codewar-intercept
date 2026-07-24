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
import { Fn, If, cameraPosition, color, cross, dot, float, instanceIndex, mix, mul, normalWorld, normalize, positionLocal, positionWorld, positionWorldDirection, pow, smoothstep, storage, time, uniform, vec3 } from "three/tsl";
import { TiledLighting } from "three/addons/lighting/TiledLighting.js";

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
scene.backgroundNode = Fn(() => {
  const direction = normalize(positionWorldDirection);
  const altitude = direction.y.mul(0.5).add(0.5).clamp(0, 1);
  const horizonToZenith = smoothstep(0.08, 0.82, altitude);
  const skyGradient = mix(color(0x9aaeb3), color(0x173f75), horizonToZenith);
  const sunAmount = dot(direction, sunDirection).max(0);
  const mieHalo = pow(sunAmount, 42).mul(color(0xffbd78)).mul(0.72);
  const sunDisk = smoothstep(0.99972, 0.99991, sunAmount).mul(color(0xffe0ad)).mul(4.2);
  const horizonWarmth = pow(float(1).sub(altitude), 6).mul(color(0xd69a63)).mul(0.18);
  return skyGradient.add(mieHalo).add(sunDisk).add(horizonWarmth);
})();
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
const wavePosition = Fn(() => {
  const p = positionLocal.toVar();
  const x = p.x;
  const z = p.y;
  const phaseA = x.mul(0.105).add(z.mul(0.041)).add(time.mul(0.72));
  const phaseB = x.mul(-0.074).add(z.mul(0.162)).add(time.mul(1.08));
  const phaseC = x.mul(0.31).add(z.mul(-0.19)).add(time.mul(1.74));
  const height = phaseA.sin().mul(0.52).add(phaseB.sin().mul(0.24)).add(phaseC.sin().mul(0.07));
  return vec3(x, z, height);
})();
seaMaterial.positionNode = wavePosition;
seaMaterial.normalNode = Fn(() => {
  const p = positionLocal;
  const phaseA = p.x.mul(0.105).add(p.y.mul(0.041)).add(time.mul(0.72));
  const phaseB = p.x.mul(-0.074).add(p.y.mul(0.162)).add(time.mul(1.08));
  const phaseC = p.x.mul(0.31).add(p.y.mul(-0.19)).add(time.mul(1.74));
  const dx = phaseA.cos().mul(0.0546).add(phaseB.cos().mul(-0.01776)).add(phaseC.cos().mul(0.0217));
  const dz = phaseA.cos().mul(0.02132).add(phaseB.cos().mul(0.03888)).add(phaseC.cos().mul(-0.0133));
  return normalize(cross(vec3(1, 0, dx), vec3(0, 1, dz)));
})();
seaMaterial.colorNode = Fn(() => {
  const distance = cameraPosition.distance(positionWorld);
  const viewDirection = normalize(cameraPosition.sub(positionWorld));
  const facing = dot(normalWorld, viewDirection).max(0);
  const fresnel = float(0.035).add(float(0.965).mul(pow(float(1).sub(facing), 5)));
  const water = mix(color(0x082c3e), color(0x1b6b7e), facing.mul(0.32));
  const environmentReflection = mix(color(0x7798a8), color(0x244c70), normalWorld.y.clamp(0, 1)).mul(fresnel.mul(0.72));
  const crest = smoothstep(0.48, 0.78, wavePosition.z).mul(color(0xc4e1e6)).mul(0.2);
  const aerial = smoothstep(55, 170, distance);
  return mix(water.add(environmentReflection).add(crest), color(0x6f8997), aerial.mul(0.2));
})();
seaMaterial.emissiveNode = mul(seaMaterial.colorNode, 0.26);
const sea = new Mesh(new PlaneGeometry(180, 180, 220, 220), seaMaterial);
sea.rotation.x = -Math.PI / 2;
scene.add(sea);

const particleCount = 32768;
const positionAttribute = new StorageBufferAttribute(particleCount, 3);
const velocityAttribute = new StorageBufferAttribute(particleCount, 3);
const positions = storage(positionAttribute, "vec3", particleCount);
const velocities = storage(velocityAttribute, "vec3", particleCount);
const deltaTime = uniform(1 / 60);
const initializeParticles = Fn(() => {
  const index = float(instanceIndex);
  const angle = index.mul(2.399963).mod(6.283185);
  const radius = index.mod(191).div(191).mul(8).add(1);
  positions.element(instanceIndex).assign(vec3(angle.cos().mul(radius), index.mod(37).div(37).mul(9).add(1), angle.sin().mul(radius)));
  velocities.element(instanceIndex).assign(vec3(angle.sin().mul(1.4), index.mod(13).div(13).mul(3).add(1), angle.cos().mul(1.4)));
})().compute(particleCount);
const updateParticles = Fn(() => {
  const position = positions.element(instanceIndex);
  const velocity = velocities.element(instanceIndex);
  velocity.y.subAssign(deltaTime.mul(2.8));
  position.addAssign(velocity.mul(deltaTime));
  If(position.y.lessThan(0.15), () => {
    position.y.assign(0.15);
    velocity.y.assign(velocity.y.abs().mul(0.62));
  });
})().compute(particleCount);
const particleGeometry = new BufferGeometry();
particleGeometry.setAttribute("position", positionAttribute);
particleGeometry.setDrawRange(0, particleCount);
const particleMaterial = new PointsNodeMaterial({ transparent: true, depthWrite: false, size: 3.5, sizeAttenuation: true });
particleMaterial.colorNode = vec3(1.0, 0.38, 0.08);
const particles = new Points(particleGeometry, particleMaterial);
particles.frustumCulled = false;
scene.add(particles);
await renderer.computeAsync(initializeParticles);

canvas.dataset.backend = renderer.backend.constructor.name === "WebGPUBackend" ? "WEBGPU" : "FALLBACK";
canvas.dataset.pbr = "MESH_STANDARD_NODE";
canvas.dataset.tiledLights = "24";
canvas.dataset.storageParticles = String(particleCount);
canvas.dataset.depthOcclusion = "SHARED_RENDERER_DEPTH";
canvas.dataset.tslOcean = "GERSTNER_ANALYTIC_NORMAL_3_WAVE";
canvas.dataset.tslSky = "PHYSICAL_AFTERNOON_SCATTER";
status.textContent = `WEBGPU NATIVE\nPBR + TILED LIGHTS 24\nSTORAGE PARTICLES ${particleCount}`;
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
