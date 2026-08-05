import { DEFAULT_THREAT_ID } from "../../threats/catalog.js";
import type { ScenarioDocument } from "../../scenario-system/types.js";

/**
 * Compatibility document for the original three-missile surface-defense case.
 * It deliberately contains data only; the scenario compiler owns all runtime conversion.
 */
export const DEFAULT_SURFACE_DEFENSE_SCENARIO: ScenarioDocument = {
  schemaVersion: 1,
  id: "legacy-surface-defense",
  metadata: {
    title: "NTU Surface Defense",
    subtitle: "LEGACY SANDBOX BASELINE",
    description: "The original Long Beach three-threat interception case, represented through the common scenario pipeline.",
    year: 1988,
    region: "Open-ocean exercise area",
    author: "Cold War Intercept Team",
    tags: ["legacy", "ntu", "surface-defense"],
    builtIn: true,
  },
  simulation: {
    seed: 1988001,
    durationSeconds: 360,
    worldUnitsPerKm: 10,
    datalinkEra: "ntu-baseline",
    sovietCommandEra: "ntu-1980s",
    advancedAirAi: false,
    autoFire: true,
  },
  environment: { presetId: "open-ocean-afternoon", timeOfDay: "afternoon" },
  forces: [{
    kind: "ship", id: "blue-long-beach", platformId: "long-beach", side: "blue",
    forceId: "blue-surface-defense", position: [0, 0, 40], headingDeg: 0,
    speedKnots: 0, formationRole: "command", commandRoles: ["otc", "aawc"],
    lostCommsDoctrineId: "us-ntu-command", radarState: "active", ecmEnabled: true,
  }],
  threatWaves: [{
    id: "initial-p500-raid", threatId: DEFAULT_THREAT_ID, side: "red", source: "in-flight",
    count: 3, firstLaunchAt: 0, intervalSeconds: 0,
    origin: [0, 20, -225], altitude: 20, spread: 165,
  }],
  routes: [], zones: [], timeline: [],
  objectives: [{
    id: "survive-initial-raid", side: "blue", title: "Defend the cruiser",
    description: "Keep Long Beach operational through the initial missile raid.",
    kind: "protect", targetIds: ["blue-long-beach"],
  }],
  guidance: {
    briefing: {
      strategicBackground: ["A compact compatibility scenario for the original interception sandbox."],
      blueMission: ["Detect, engage and defeat the inbound anti-ship missiles."],
      intelligenceEstimate: ["Three inbound weapons are expected from the northern threat axis."],
      features: ["Uses the same scenario compiler and runtime as later data-driven scenarios."],
      controls: ["Use the sandbox controls to create a customized derivative exercise."],
    },
    estimatedContactWindow: [0, 45], cues: [],
  },
};
