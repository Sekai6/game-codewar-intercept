import * as THREE from "three";
import { registerAssetDetailLod, updateRegisteredAssetDetailLods } from "../dist-test/visual/asset-detail-lod.js";

const scene = new THREE.Group(), asset = new THREE.Group(), high = new THREE.Group(), medium = new THREE.Group(), low = new THREE.Group(), persistent = new THREE.Group();
asset.add(high, medium, low, persistent);scene.add(asset);
registerAssetDetailLod(asset, { nearDistance: 270, mediumDistance: 340, high:[high], medium:[medium], low:[low], persistentUntilMedium:[persistent], exclusiveTiers:true });

const samples = [100, 300, 400].map((distance) => {
  updateRegisteredAssetDetailLods(scene, new THREE.Vector3(distance, 0, 0));
  return { distance, high:high.visible, medium:medium.visible, low:low.visible, persistent:persistent.visible };
});
console.log(JSON.stringify(samples, null, 2));
const expected = [
  { high:true, medium:false, low:false, persistent:true },
  { high:false, medium:true, low:false, persistent:true },
  { high:false, medium:false, low:true, persistent:false },
];
if (samples.some((sample, index) => Object.entries(expected[index]).some(([key, value]) => sample[key] !== value))) process.exitCode = 1;
