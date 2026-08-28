import type * as THREE from "three";
import type {
  EngagementRecord,
  EngagementSourceId,
} from "../defense/engagement";
import type {
  CombatEntity,
  CombatSide,
  TargetableEntity,
} from "../combat-entity";
import type { EnemyType } from "../threats/catalog";
import type { FormationStatus } from "./formation";
import type { DatalinkEra } from "../datalink/era.js";
import type { SovietCommandEra } from "../soviet-c2/era.js";
import type { AdvancedFlightState } from "./flight/aircraft-performance";
import type { AirTacticalState } from "./ai/tactical-state";
import type { PilotPerceptionState } from "./ai/perception";
import type { MissionPlannerState } from "./ai/mission-planner";
import type { PilotModel, PilotSkill, PilotState } from "./ai/pilot-model";
import type { EmconMode, PassiveSensorSuite, PassiveTrackData } from "../sensors/passive-types.js";

export type AirMissionOrder =
  "cap" | "intercept" | "escort" | "anti-ship" | "sead" | "aew" | "egress" | "return";
export type AirThrustMode = "idle" | "cruise" | "military" | "afterburner";
export interface AirThrustDefinition {
  militarySpeedFactor: number;
  militaryAccelerationFactor: number;
  militaryFuelMultiplier: number;
  militaryInfraredMultiplier: number;
  afterburnerAvailable: boolean;
  afterburnerSpeedFactor: number;
  afterburnerAccelerationFactor: number;
  afterburnerFuelMultiplier: number;
  afterburnerInfraredMultiplier: number;
  afterburnerSeconds: number;
}
export interface AirAerodynamicDefinition {
  referenceMassKg: number;
  wingAreaM2: number;
  zeroLiftDragCoefficient: number;
  inducedDragFactor: number;
  liftCurveSlopePerDeg: number;
  criticalAngleOfAttackDeg: number;
  controlResponseSeconds: number;
  engineSpoolUpSeconds: number;
  engineSpoolDownSeconds: number;
}
export type AirGuidance =
  "active-radar" | "semi-active-radar" | "infrared" | "anti-ship-radar" | "anti-radiation";
export type AirPlatformId =
  | "F-14A" | "TU-16K" | "A-6E" | "MIG-29A" | "MIG-29A-SEAD"
  | "E-2C" | "TU-126";
export type AirWeaponId =
  | "AIM-54A" | "AIM-54X-CEC" | "AIM-7F" | "AIM-9L"
  | "R-27R" | "R-73" | "AGM-45A" | "AGM-88A" | "Kh-31P-C"
  | "KSR-5" | "AGM-84A";
export type AirSubsystem =
  | "structure"
  | "left-engine"
  | "right-engine"
  | "radar"
  | "flight-control"
  | "weapons";
export interface CountermeasureReleaseProgram {
  type: "chaff" | "flare";
  remaining: number;
  nextReleaseAt: number;
  interval: number;
}

export interface AirWeaponDefinition {
  id: AirWeaponId;
  name: string;
  targets: readonly ("aircraft" | "ship")[];
  guidance: AirGuidance;
  /** Historical Phoenix guidance remains launch-platform bound. */
  midcourseSupport?: "launch-platform-only" | "cec-network-native";
  cecMidcourseUpdates?: boolean;
  minRange: number;
  maxRange: number;
  speed: number;
  boostSeconds: number;
  maxTurnRateDeg: number;
  seekerRange: number;
  seekerFovDeg: number;
  datalinkInterval: number;
  damage: number;
  proximityRadius: number;
  countermeasureResistance: number;
  massKg: number;
  dragIndex: number;
  shipDefenseTemplate: EnemyType;
  antiShipFlight?: {
    boostAltitude: number;
    cruiseAltitude: number;
    terminalAltitude: number;
    boostSpeedFactor: number;
    cruiseSpeedFactor: number;
    terminalTurnFactor: number;
  };
  airToAirFlight?: {
    sustainSeconds: number;
    coastDragPerSecond: number;
    minimumSpeedFactor: number;
    maximumFlightSeconds: number;
    loftAltitude: number;
    loftTransitionRange: number;
  };
}

export interface AirSensorDefinition {
  name: string;
  range: number;
  updateInterval: number;
  fieldOfViewDeg: number;
  precision: number;
  coverage?: "forward-sector" | "rotating-360";
}

export interface CountermeasureProgram {
  chaffBurst: number;
  flareBurst: number;
  interval: number;
  cooldown: number;
  triggerTti: number;
}

export interface AirPlatformDefinition {
  id: AirPlatformId;
  name: string;
  nation: string;
  role: string;
  tacticalRole?: "fighter" | "bomber" | "attack" | "aew";
  mission: AirMissionOrder;
  radarCrossSection: number;
  infraredSignature: number;
  flight: {
    cruiseSpeed: number;
    maxSpeed: number;
    stallSpeed: number;
    acceleration: number;
    drag: number;
    maxLoadFactor: number;
    maxRollRateDeg: number;
    maxPitchRateDeg: number;
    maxAngleOfAttackDeg?: number;
    fuelSeconds: number;
    aerodynamics: AirAerodynamicDefinition;
    thrust: AirThrustDefinition;
  };
  sensor: AirSensorDefinition;
  passiveSensors?: PassiveSensorSuite;
  datalink?: {
    link16?: true;
    link11?: true;
    link11NetControlCapable?: boolean;
    minimumEra?: "jtids-transition" | "link16-modernized";
    terminalName: string;
    terminalReliability: number;
    timeSyncQuality: number;
  };
  aewCommand?: {
    mode: "link4a" | "voice-gci";
    controllerCapacity: number;
    commandDelay: number;
    commandLife: number;
    reliability: number;
    fighterPlatformIds: readonly AirPlatformId[];
  };
  ecm: { strength: number; burnThroughRange: number };
  countermeasures: {
    chaff: number;
    flares: number;
    program: CountermeasureProgram;
  };
  loadout: Readonly<Record<AirWeaponId, number>>;
  fireControlChannels: { datalink: number; illumination: number };
  hardpoints: readonly {
    id: string;
    position: readonly [number, number, number];
    compatibleWeapons: readonly AirWeaponId[];
    releaseDelay: number;
    ignitionDelay: number;
  }[];
  buildModel: () => THREE.Group;
  shipDefenseTemplate: EnemyType;
}

export interface AirShipDefenseContact {
  entity: TargetableEntity;
  name: string;
  model: THREE.Group;
  template: EnemyType;
  phase: "inbound" | "boost" | "midcourse" | "terminal";
}

export interface AirTrack {
  targetId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  uncertainty: number;
  lastUpdate: number;
  classification: "unknown" | "aircraft" | "ship";
  targetRole?: AirPlatformDefinition["tacticalRole"];
  source?: "local-radar" | "link11" | "link16" | "irst" | "esm" | "passive-fusion";
  engagementQuality?: "cue" | "weapon";
  originSensorId?: string;
  observationId?: string;
  senderId?: string;
  receivedAt?: number;
  passive?: PassiveTrackData;
}

export interface AirPlatformInstance extends TargetableEntity {
  kind: "aircraft";
  definition: AirPlatformDefinition;
  model: THREE.Group;
  formationId: string;
  formationIndex: number;
  leaderId: string | null;
  protectedId: string | null;
  mission: AirMissionOrder;
  fuel: number;
  thrustMode: AirThrustMode;
  afterburnerRemaining: number;
  heading: THREE.Vector3;
  desiredDirection: THREE.Vector3;
  bank: number;
  advancedFlightState: AdvancedFlightState;
  tacticalState: AirTacticalState;
  pilotPerception: PilotPerceptionState;
  pilotState: PilotState;
  pilotSkill: PilotSkill;
  pilotModel: PilotModel;
  nextPilotUpdate: number;
  missionPlanningState: MissionPlannerState;
  nextMissionPlanningUpdate: number;
  nextPerceptionUpdate: number;
  tracks: Map<string, AirTrack>;
  networkTracks: Map<string, AirTrack>;
  ammo: Map<AirWeaponId, number>;
  subsystemHealth: Map<AirSubsystem, number>;
  nextOoda: number;
  nextScan: number;
  nextPassiveScan: number;
  nextCountermeasure: number;
  radarActive: boolean;
  ecmActive: boolean;
  emconMode: EmconMode;
  passiveTracks: Map<string, AirTrack>;
  noContactSince: number | null;
  chaff: number;
  flares: number;
  state:
    "formation" | "engaging" | "defending" | "egress" | "departed-safe" | "disabled" | "crashed";
  targetId: string | null;
  engagements: Map<EngagementSourceId, EngagementRecord>;
  missileWarnings: Map<string, AirTrack>;
  hardpoints: AirHardpointInstance[];
  countermeasurePrograms: CountermeasureReleaseProgram[];
  formationStatus: FormationStatus;
  formationError: number;
  scenarioRoute: readonly THREE.Vector3[];
  scenarioRouteLoop: boolean;
  scenarioRouteIndex: number;
  scenarioLaunchZone: { center: THREE.Vector3; radius: number } | null;
  scenarioStrikeWaveId: string | null;
  scenarioWeaponsHoldUntil: number;
  scenarioExitZone: { center: THREE.Vector3; radius: number } | null;
  departedAt: number | null;
}

export interface AirHardpointInstance {
  id: string;
  position: THREE.Vector3;
  compatibleWeapons: readonly AirWeaponId[];
  releaseDelay: number;
  ignitionDelay: number;
  weaponId: AirWeaponId | null;
  mountedModel: THREE.Group | null;
  state: "ready" | "reserved" | "releasing" | "empty" | "damaged";
  releaseAt: number;
  targetId: string | null;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  trackQuality: number;
}

export interface AirMissileInstance extends TargetableEntity {
  kind: "missile";
  definition: AirWeaponDefinition;
  model: THREE.Group;
  shooterId: string;
  targetId: string;
  engagementTargetId: string;
  age: number;
  phase: "boost" | "midcourse" | "terminal" | "destroyed";
  commandPoint: THREE.Vector3;
  nextDatalink: number;
  seekerAcquired: boolean;
  illuminationLostAt: number | null;
  softKillResolved?: boolean;
  countermeasureRequested?: boolean;
  countermeasureRequestedAt?: number;
  ignitionDelay: number;
  releaseAge: number;
  nextSeekerAttempt: number;
  engagementSettled: boolean;
  launchRange: number;
  launchRtr: number;
  launchRmax: number;
  maximumAltitude: number;
  midcourseLastUpdateAt: number;
  midcourseTrackQuality: number;
  midcourseUncertainty: number;
  midcourseLinkLostAt: number | null;
  inertialContinuation: boolean;
  autonomousSearchAuthorized: boolean;
  midcourseSource: "organic-radar" | "network-cue" | "launch-solution";
  armSeekerMode?: import("../arm/types.js").ArmSeekerMode;
  targetEmitterId?: string;
  armMemoryExpiresAt?: number;
}

export interface AirDecoyInstance extends CombatEntity {
  kind: "decoy";
  decoyType: "chaff" | "flare";
  model: THREE.Object3D;
  age: number;
  life: number;
}

export interface AirScenarioContext {
  blueShip: TargetableEntity;
  redShip: TargetableEntity | null;
  datalinkEra?: DatalinkEra;
  datalinkEnabled?: boolean;
  link16Enabled?: boolean;
  sovietCommandEra?: SovietCommandEra;
  sovietCommandEnabled?: boolean;
  advancedAirAiEnabled?: boolean;
  localWeatherAt?: (position: THREE.Vector3) => {
    radarRangeFactor: number;
    detectionProbabilityFactor: number;
    measurementNoiseFactor: number;
    turbulence: number;
  };
  targets?: readonly TargetableEntity[];
  targetAliases?: Readonly<Record<string, string>>;
  countermeasures?: (targetId: string) => {
    ecmEnabled: boolean;
    ecmStrength: number;
    ecmHealth: number;
    burnThroughRange: number;
    decoys: readonly { position: THREE.Vector3; rcs: number }[];
  } | null;
  requestShipCountermeasure?: (request: {
    targetId: string;
    threatId: string;
    threatPosition: THREE.Vector3;
  }) => boolean;
  tacticalNetworkParticipants?: readonly {
    entity: CombatEntity;
    terminalHealth: number;
    timeSyncQuality: number;
    reports: readonly AirTrack[];
  }[];
  /** Compatibility alias for pre-era integrations. */
  link16Participants?: AirScenarioContext["tacticalNetworkParticipants"];
}

export type AirCombatEvent = {
  time: number;
  kind:
    | "detect"
    | "launch"
    | "countermeasure"
    | "hit"
    | "damage"
    | "kill"
    | "guidance"
    | "maneuver"
    | "emcon";
  text: string;
  side?: CombatSide;
  platformId?: string;
  entityId?: string;
  launchId?: string;
  weaponId?: string;
  launcherId?: string;
  targetTrackId?: string;
  targetEmitterId?: string;
  armSeekerMode?: string;
};

export interface AirSpawn {
  definition: AirPlatformDefinition;
  side: CombatSide;
  formationId: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  formationIndex: number;
  leaderId?: string;
  mission?: AirMissionOrder;
  protectedFormationId?: string;
  pilotSkill?: PilotSkill;
  scenarioRoute?: readonly THREE.Vector3[];
  scenarioRouteLoop?: boolean;
  scenarioLaunchZone?: { center: THREE.Vector3; radius: number };
  scenarioStrikeWaveId?: string;
  scenarioStrikeWave?: {
    id: string;
    side: CombatSide;
    shooterFormationIds: readonly string[];
    targetCandidates: readonly string[];
    plannedLaunchWindow: readonly [number, number];
    desiredImpactTime?: number;
    minimumShooters: number;
    maximumShooters: number;
    maximumWeaponsPerTarget: number;
  };
  scenarioWeaponsHoldUntil?: number;
  scenarioExitZone?: { center: THREE.Vector3; radius: number };
  initialSpeed?: number;
  initialRadarState?: "active" | "silent";
  initialEcmEnabled?: boolean;
  initialLoadout?: Partial<Record<AirWeaponId, number>>;
}
