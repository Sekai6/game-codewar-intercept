export type ScenarioVec3 = readonly [number, number, number];
export type ScenarioSide = "blue" | "red" | "neutral";
export type GuidanceLevel = "full" | "critical";

export interface ScenarioMetadata {
  title: string;
  subtitle?: string;
  description: string;
  year: number;
  region: string;
  author?: string;
  tags: readonly string[];
  builtIn: boolean;
}

export interface ScenarioSimulationConfig {
  seed: number;
  durationSeconds: number;
  worldUnitsPerKm: number;
  datalinkEra: string;
  sovietCommandEra: string;
  advancedAirAi: boolean;
  autoFire: boolean;
}

export interface ScenarioEnvironmentConfig {
  presetId: string;
  spaceWeatherPresetId?: string;
  auroraControlled?: boolean;
  coastBackdropId?: string;
  timeOfDay?: string;
}

export interface ScenarioShipDefinition {
  kind: "ship";
  id: string;
  platformId: string;
  side: ScenarioSide;
  forceId: string;
  position: ScenarioVec3;
  headingDeg: number;
  speedKnots: number;
  formationRole: "command" | "picket" | "screen" | "escort" | "hvu";
  commandRoles: readonly ("otc" | "aawc" | "asuwc")[];
  routeId?: string;
  lostCommsDoctrineId?: string;
  radarState?: "active" | "silent";
  ecmEnabled?: boolean;
  loadout?: Readonly<Record<string, number>>;
}

export interface ScenarioAirFormationDefinition {
  kind: "air-formation";
  id: string;
  platformId: string;
  side: ScenarioSide;
  count: number;
  position: ScenarioVec3;
  headingDeg: number;
  speed?: number;
  altitude: number;
  mission: "cap" | "intercept" | "escort" | "anti-ship" | "aew" | "egress" | "return";
  routeId?: string;
  launchZoneId?: string;
  protectedFormationId?: string;
  lostCommsDoctrineId?: string;
  radarState?: "active" | "silent";
  ecmEnabled?: boolean;
  loadout?: Readonly<Record<string, number>>;
  deployment?: {
    zoneId: string;
    groupId?: string;
    offset?: ScenarioVec3;
    minRadiusFactor?: number;
    maxRadiusFactor?: number;
    routeMode?: "translate" | "converge";
  };
}

export interface ScenarioThreatWaveDefinition {
  id: string;
  threatId: string;
  side: Exclude<ScenarioSide, "neutral">;
  source: "in-flight" | "surface-platform";
  sourcePlatformId?: string;
  count: number;
  firstLaunchAt: number;
  intervalSeconds: number;
  origin: ScenarioVec3;
  altitude: number;
  spread: number;
}

export type ScenarioForceDefinition = ScenarioShipDefinition | ScenarioAirFormationDefinition;

export interface ScenarioRouteDefinition {
  id: string;
  kind: "transit" | "orbit" | "attack" | "rendezvous";
  loop?: boolean;
  points: readonly { position: ScenarioVec3; speed?: number; altitude?: number }[];
}

export interface ScenarioZoneDefinition {
  id: string;
  kind: "rendezvous" | "launch-corridor" | "weather-front" | "magnetic-disturbance" | "comms-window" | "exclusion" | "threat-estimate" | "deployment-zone";
  center: ScenarioVec3;
  radius: number;
  side?: ScenarioSide;
  visibleInBriefing?: boolean;
  motion?: {
    velocity: ScenarioVec3;
    oscillation?: { axis: ScenarioVec3; amplitude: number; periodSeconds: number };
  };
  weather?: {
    intensity: number;
    visibilityKm: number;
    radarAttenuation: number;
    measurementNoise: number;
    turbulence: number;
    cloudBase: number;
    cloudTop: number;
  };
}

export interface ScenarioTimelineEvent {
  id: string;
  at: number;
  type: "space-weather-phase" | "comms-window" | "objective" | "guidance";
  value: string;
  duration?: number;
}

export interface ScenarioObjectiveDefinition {
  id: string;
  side: ScenarioSide;
  title: string;
  description: string;
  kind: "protect" | "intercept" | "survive" | "observe" | "strike";
  targetIds: readonly string[];
  optional?: boolean;
  criteria?: {
    requiredLaunchByFormationIds?: readonly string[];
    forbiddenLaunchByFormationIds?: readonly string[];
    requiredWeaponIds?: readonly string[];
    requiredSpaceWeatherPhases?: readonly string[];
  };
}

export type GuidanceTrigger =
  | { type: "time"; at: number }
  | { type: "space-weather-phase"; phase: string }
  | { type: "network-state"; side: ScenarioSide; state: "degraded" | "disconnected" | "recovering" }
  | { type: "platform-lost-comms"; platformId: string }
  | { type: "confirmed-track"; side: ScenarioSide; classification: "aircraft" | "ship" | "missile" }
  | { type: "weapon-launch"; side?: ScenarioSide; platformId?: string }
  | { type: "objective-state"; objectiveId: string; state: "active" | "complete" | "failed" }
  | { type: "inactivity"; seconds: number };

export interface GuidanceFocus {
  kind: "entity" | "formation" | "zone" | "overview" | "network";
  targetId?: string;
  label: string;
}

export interface ScenarioGuidanceCue {
  id: string;
  level: GuidanceLevel;
  trigger: GuidanceTrigger;
  title: string;
  message: string;
  category: "mission" | "sensor" | "network" | "weather" | "combat";
  focus?: GuidanceFocus;
  expiresAfter?: number;
  once: boolean;
}

export interface ScenarioGuidanceDefinition {
  soundtrack?: {
    id: string;
    title: string;
    theme?: {
      title: string;
      file: string;
      durationSeconds: number;
    };
  };
  briefing: {
    strategicBackground: readonly string[];
    blueMission: readonly string[];
    intelligenceEstimate: readonly string[];
    features: readonly string[];
    controls: readonly string[];
    dossier?: {
      title: string;
      classification: string;
      dateline: string;
      lead: string;
      sections: readonly {
        heading: string;
        kicker?: string;
        paragraphs: readonly string[];
      }[];
    };
  };
  estimatedContactWindow?: readonly [number, number];
  cues: readonly ScenarioGuidanceCue[];
}

export interface ScenarioDocument {
  schemaVersion: 1;
  id: string;
  metadata: ScenarioMetadata;
  simulation: ScenarioSimulationConfig;
  environment: ScenarioEnvironmentConfig;
  forces: readonly ScenarioForceDefinition[];
  threatWaves?: readonly ScenarioThreatWaveDefinition[];
  routes: readonly ScenarioRouteDefinition[];
  zones: readonly ScenarioZoneDefinition[];
  timeline: readonly ScenarioTimelineEvent[];
  objectives: readonly ScenarioObjectiveDefinition[];
  guidance: ScenarioGuidanceDefinition;
}

export interface ScenarioValidationIssue {
  path: string;
  message: string;
}

export interface ScenarioValidationResult {
  valid: boolean;
  issues: ScenarioValidationIssue[];
}
