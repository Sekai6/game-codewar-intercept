import type { ScenarioDocument } from "./types.js";

const CURRENT_SCHEMA_VERSION = 1 as const;
type Migration = (document: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS = new Map<number, Migration>();

export function migrateScenarioDocument(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  let document = structuredClone(input as Record<string, unknown>);
  let version = document.schemaVersion;
  if (!Number.isInteger(version)) throw new Error(`Unsupported scenario schema version: ${String(version)}`);
  if (Number(version) > CURRENT_SCHEMA_VERSION) throw new Error(`Scenario schema v${String(version)} is newer than supported v${CURRENT_SCHEMA_VERSION}`);
  while (Number(version) < CURRENT_SCHEMA_VERSION) {
    const migrate = MIGRATIONS.get(Number(version));
    if (!migrate) throw new Error(`No migration path from scenario schema v${String(version)} to v${CURRENT_SCHEMA_VERSION}`);
    document = migrate(document);
    const next = document.schemaVersion;
    if (!Number.isInteger(next) || Number(next) <= Number(version)) throw new Error(`Invalid migration result from schema v${String(version)}`);
    version = next;
  }
  return document;
}

export function currentScenarioSchemaVersion(): ScenarioDocument["schemaVersion"] { return CURRENT_SCHEMA_VERSION; }
