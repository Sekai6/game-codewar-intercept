import * as THREE from "three";
import type { PlanformPoint } from "../model-kit.js";

export const TAPERED_PYLON_RAIL_CENTER_Y = 0.055;
export const TAPERED_PYLON_RAIL_HEIGHT = 0.055;
export const TAPERED_PYLON_RAIL_BOTTOM_Y =
  TAPERED_PYLON_RAIL_CENTER_Y - TAPERED_PYLON_RAIL_HEIGHT * 0.5;

export function createBeveledPlanform(
  points: readonly PlanformPoint[],
  material: THREE.Material,
  thickness: number,
  bevelSize = Math.min(0.055, thickness * 0.32),
  bevelSegments = 2,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments,
    bevelSize,
    bevelThickness: bevelSize * 0.72,
    // Keep the authored planform as the outer dimensional contract. Three's
    // default bevel expands the silhouette beyond those points, which made
    // Ultra aircraft slightly wider than their High/Low counterparts.
    bevelOffset: -bevelSize,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -thickness * 0.5);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function createTaperedPylon(
  material: THREE.Material,
  railMaterial: THREE.Material,
  height: number,
  rootChord: number,
  width: number,
  railLength: number,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-rootChord * 0.46, 0.08);
  shape.lineTo(-rootChord * 0.25, height);
  shape.lineTo(rootChord * 0.3, height * 0.96);
  shape.lineTo(rootChord * 0.46, 0.08);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.025, width * 0.16),
    bevelThickness: Math.min(0.018, width * 0.12),
    bevelOffset: -Math.min(0.025, width * 0.16),
  });
  geometry.translate(0, 0, -width * 0.5);
  geometry.rotateY(-Math.PI / 2);
  const group = new THREE.Group();
  const body = new THREE.Mesh(geometry, material);
  group.add(body);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.18, TAPERED_PYLON_RAIL_HEIGHT, railLength),
    railMaterial,
  );
  rail.position.y = TAPERED_PYLON_RAIL_CENTER_Y;
  group.add(rail);
  return group;
}

export function configureSurfaceMarking(marking: THREE.Object3D) {
  marking.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const configureMaterial = (material: THREE.Material) => {
      const configured = material.clone();
      configured.side = THREE.DoubleSide;
      configured.polygonOffset = true;
      configured.polygonOffsetFactor = -2;
      configured.polygonOffsetUnits = -2;
      configured.needsUpdate = true;
      return configured;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(configureMaterial)
      : configureMaterial(object.material);
    object.castShadow = false;
    object.renderOrder = 4;
  });
  return marking;
}
