import blackoutScenario from "../scenarios/full-spectrum-blackout/scenario.json";
import { DEFAULT_SURFACE_DEFENSE_SCENARIO } from "../scenarios/legacy-adapters/default-surface-defense.js";
import { normalizeScenarioDocument } from "./normalizer.js";
import type { ScenarioDocument } from "./types.js";

const builtIns = [normalizeScenarioDocument(DEFAULT_SURFACE_DEFENSE_SCENARIO), normalizeScenarioDocument(blackoutScenario)] as const;

export const BUILT_IN_SCENARIOS: readonly ScenarioDocument[] = builtIns;
export const BUILT_IN_SCENARIO_BY_ID: ReadonlyMap<string, ScenarioDocument> = new Map(
  builtIns.map((scenario) => [scenario.id, scenario]),
);

export function getBuiltInScenario(id: string): ScenarioDocument {
  const scenario = BUILT_IN_SCENARIO_BY_ID.get(id);
  if (!scenario) throw new Error(`Unknown built-in scenario: ${id}`);
  return scenario;
}

/** Creates an immutable, non-built-in document suitable for editing/export. */
export function copyBuiltInScenario(id: string, copyId = `${id}-copy`): ScenarioDocument {
  const source = getBuiltInScenario(id);
  return normalizeScenarioDocument({
    ...structuredClone(source),
    id: copyId,
    metadata: {
      ...structuredClone(source.metadata),
      title: `${source.metadata.title} (Copy)`,
      builtIn: false,
    },
  });
}
