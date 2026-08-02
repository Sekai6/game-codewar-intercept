import type { ScenarioDocument } from "./types.js";

export function migrateScenarioDocument(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return input;
  throw new Error(`Unsupported scenario schema version: ${String(version)}`);
}

export function currentScenarioSchemaVersion(): ScenarioDocument["schemaVersion"] { return 1; }
