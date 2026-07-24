import * as THREE from "three";
import { createAuroraEnvironment } from "./aurora-environment";
import type { HighQualityEnvironment } from "./high-quality-environment";
import type { OceanSurface } from "./ocean";

export interface AuroraRuntime {
  readonly requested: boolean;
  readonly active: boolean;
  activate(ultraActive: boolean): boolean;
  handleUltraDisabled(): void;
  update(time: number, cameraPosition: THREE.Vector3): void;
  writeDiagnostics(canvas: HTMLCanvasElement): void;
  dispose(): void;
}

interface AuroraRuntimeOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  highQualityEnvironment: HighQualityEnvironment;
  ocean: OceanSurface;
  ambientSky: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  atmosphericFill: THREE.DirectionalLight;
  ultraInput: HTMLInputElement;
  menu: HTMLElement;
  insertBefore: Element;
  requestUltra: () => Promise<void> | void;
}

export function createAuroraRuntime(options: AuroraRuntimeOptions): AuroraRuntime {
  const environment = createAuroraEnvironment();
  options.scene.add(environment.object);
  const field = document.createElement("label");
  field.className = "sandbox-toggle aurora-toggle";
  field.title = "Ultra-only hidden environment. It never activates unless this separate option is checked.";
  field.innerHTML = '<input id="sbAuroraEnvironment" type="checkbox"> ✦ BEAUTIFUL AURORA / ULTRA EASTER EGG';
  options.menu.insertBefore(field, options.insertBefore);
  const input = field.querySelector("input") as HTMLInputElement;
  let active = false;

  input.addEventListener("change", async () => {
    if (!input.checked || options.ultraInput.checked) return;
    options.ultraInput.checked = true;
    await options.requestUltra();
  });

  function apply(enabled: boolean) {
    active = enabled;
    environment.setEnabled(enabled);
    options.highQualityEnvironment.setAuroraMode(enabled);
    options.ocean.setAuroraMode(enabled);
    if (!enabled) return;
    options.renderer.toneMappingExposure = 1.22;
    options.ambientSky.intensity = 0.54;
    options.ambientSky.color.setHex(0x4a8ca0);
    options.ambientSky.groundColor.setHex(0x06131b);
    options.sun.intensity = 0.32;
    options.sun.color.setHex(0x9ab9df);
    options.atmosphericFill.intensity = 0.28;
    options.scene.fog = new THREE.FogExp2(0x071823, 0.00042);
  }

  return {
    get requested() { return input.checked; },
    get active() { return active; },
    activate(ultraActive) {
      apply(input.checked && ultraActive);
      return active;
    },
    handleUltraDisabled() {
      input.checked = false;
      apply(false);
    },
    update(time, cameraPosition) { environment.update(time, cameraPosition); },
    writeDiagnostics(canvas) {
      canvas.dataset.auroraRequested = String(input.checked);
      canvas.dataset.auroraEnvironment = String(active);
      canvas.dataset.auroraLayers = String(active ? environment.layerCount : 0);
      canvas.dataset.auroraRequiresUltra = "true";
    },
    dispose() {
      options.scene.remove(environment.object);
      environment.dispose();
      field.remove();
    },
  };
}
