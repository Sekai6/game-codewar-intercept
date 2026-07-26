import * as THREE from "three";
import type { ShipRadarDecoy } from "../ships/types.js";

function createChaffCloud(decoy: ShipRadarDecoy) {
  const count = 72;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const seed = index + decoy.id.length * 17;
    const radius = 0.8 + (seed % 13) * 0.11;
    const angle = seed * 2.399963;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = ((seed * 7) % 19) * 0.09 - 0.8;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd9eee8,
    size: 0.34,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.position.copy(decoy.position);
  points.userData.decoyId = decoy.id;
  return points;
}

export class FleetElectronicWarfareVisuals {
  private readonly objects = new Map<string, THREE.Points>();

  constructor(private readonly scene: THREE.Scene) {}

  update(decoys: readonly ShipRadarDecoy[]) {
    for (const decoy of decoys) {
      let object = this.objects.get(decoy.id);
      if (!object && decoy.alive) {
        object = createChaffCloud(decoy);
        this.objects.set(decoy.id, object);
        this.scene.add(object);
      }
      if (!object) continue;
      object.position.copy(decoy.position);
      object.scale.setScalar(1 + decoy.age * 0.22);
      (object.material as THREE.PointsMaterial).opacity = Math.max(0, 0.82 * (1 - decoy.age / decoy.lifeSeconds));
      object.visible = decoy.alive;
    }
  }

  reset() {
    for (const object of this.objects.values()) {
      this.scene.remove(object);
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
    this.objects.clear();
  }

  dispose() { this.reset(); }
}
