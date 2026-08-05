import type { ScenarioEnvironmentConfig } from "../scenario-system/types.js";

export interface ScenarioEnvironmentBindings {
  setArcticCoastEnabled(enabled: boolean): void;
}

/** Resolves stable scenario asset IDs outside the application composition root. */
export function applyScenarioEnvironment(config: ScenarioEnvironmentConfig, bindings: ScenarioEnvironmentBindings) {
  bindings.setArcticCoastEnabled(config.coastBackdropId === "norwegian-barents-distant-coast");
}
