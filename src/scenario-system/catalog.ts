import blackoutScenario from "../scenarios/full-spectrum-blackout/scenario.json";
import { normalizeScenarioDocument } from "./normalizer.js";
import type { ScenarioDocument } from "./types.js";

const builtIns = [normalizeScenarioDocument(blackoutScenario)] as const;

export const BUILT_IN_SCENARIOS: readonly ScenarioDocument[] = builtIns;
export const BUILT_IN_SCENARIO_BY_ID: ReadonlyMap<string, ScenarioDocument> = new Map(
  builtIns.map((scenario) => [scenario.id, scenario]),
);

export function getBuiltInScenario(id: string): ScenarioDocument {
  const scenario = BUILT_IN_SCENARIO_BY_ID.get(id);
  if (!scenario) throw new Error(`Unknown built-in scenario: ${id}`);
  return scenario;
}
