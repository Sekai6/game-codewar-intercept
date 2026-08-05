import type { ScenarioDocument } from "./types.js";
import { assertScenarioDocument } from "./validator.js";

function ordered<T extends { id: string }>(items: readonly T[]): T[] { return [...items].sort((a, b) => a.id.localeCompare(b.id)); }

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizeScenarioDocument(input: unknown): ScenarioDocument {
  assertScenarioDocument(input);
  const clone = structuredClone(input);
  return deepFreeze({
    ...clone,
    metadata: { ...clone.metadata, tags: [...clone.metadata.tags].sort() },
    forces: ordered(clone.forces), threatWaves: ordered(clone.threatWaves ?? []), routes: ordered(clone.routes), zones: ordered(clone.zones),
    timeline: [...clone.timeline].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    objectives: ordered(clone.objectives),
    guidance: { ...clone.guidance, cues: ordered(clone.guidance.cues) },
  });
}
