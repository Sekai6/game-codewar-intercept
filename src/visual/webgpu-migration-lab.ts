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
import { Fn, If, float, instanceIndex, storage, uniform, vec3 } from "three/tsl";
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
scene.background = new Color(0x071722);
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
  const light = new PointLight(index % 2 ? 0xff6a28 : 0x55bfff, 4.5, 14);
  light.position.set(Math.sin(index * 2.17) * 13, 2.5 + (index % 4) * 1.6, Math.cos(index * 1.73) * 13);
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
const sea = new Mesh(new PlaneGeometry(180, 180), new MeshStandardNodeMaterial({ color: 0x073646, metalness: 0.62, roughness: 0.26 }));
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
status.textContent = `WEBGPU NATIVE\nPBR + TILED LIGHTS 24\nSTORAGE PARTICLES ${particleCount}`;
const clock = new Clock();
let renderedFrames = 0;
async function frame() {
  deltaTime.value = Math.min(clock.getDelta(), 0.05);
  localLights.forEach((light, index) => { light.intensity = 3.5 + Math.sin(performance.now() * 0.002 + index) * 1.2; });
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
