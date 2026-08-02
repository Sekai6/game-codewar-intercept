import type { ScenarioDocument } from "./types.js";
import { migrateScenarioDocument } from "./migration.js";
import { normalizeScenarioDocument } from "./normalizer.js";

export function importScenarioJson(json: string): ScenarioDocument {
  if (json.length > 2_000_000) throw new Error("Scenario file exceeds the 2 MB safety limit");
  return normalizeScenarioDocument(migrateScenarioDocument(JSON.parse(json)));
}

export function exportScenarioJson(document: ScenarioDocument): string {
  return `${JSON.stringify(normalizeScenarioDocument(document), null, 2)}\n`;
}
