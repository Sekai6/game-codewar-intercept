import type * as THREE from "three";
import type { TargetableEntity } from "./combat-entity";
import type { EnemyType } from "./threats/catalog";
import type { PlatformLaunchReservation } from "./platforms/types";

export type { EnemyType } from "./threats/catalog";
export type WeaponType = "RIM-67" | "SM-2MR" | "SM-2ER";
export type MissilePhase =
  | "inbound"
  | "boost"
  | "midcourse"
  | "terminal"
  | "destroyed";
export type DefenseTarget = {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  phase: MissilePhase;
  threatType: EnemyType;
  rcs: number;
  entity?: TargetableEntity;
  displayName?: string;
};
export type Missile = DefenseTarget & {
  age: number;
  history: THREE.Vector3[];
  path: THREE.Line;
  speedFactor: number;
  launchAt: number;
  aimOffset: THREE.Vector3;
  bank: number;
  platformLaunch?: {
    reservation: PlatformLaunchReservation;
    released: boolean;
    releasedAt: number | null;
    takeoverLogged: boolean;
    commandPoint: THREE.Vector3;
    commandVelocity: THREE.Vector3;
    nextDatalink: number;
    datalinkValid: boolean;
    lastDatalinkQuality: number;
    terminalSeekerAcquired: boolean;
    plannedArrivalAt: number | null;
  };
};
export type Interceptor = {
  mesh: THREE.Group;
  target: DefenseTarget;
  age: number;
  weapon: WeaponType;
  velocity: THREE.Vector3;
  distanceTraveled: number;
  history: THREE.Vector3[];
  guidancePath: THREE.Line;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  nextDatalink: number;
  datalinkValid: boolean;
  illuminated: boolean;
  illuminationBeam: THREE.Line;
};
export type LauncherRequest = { target: DefenseTarget; weapon: WeaponType };
export type Mk10Phase =
  | "ready"
  | "slewing"
  | "firing"
  | "returning"
  | "loading";
export type Mk10LauncherState = {
  name: "AFT" | "FORWARD";
  model: THREE.Group;
  stowAzimuth: number;
  phase: Mk10Phase;
  phaseSince: number;
  pending: LauncherRequest | null;
  azimuth: number;
  elevation: number;
  railIndex: number;
  reloadRail: number;
  rounds: THREE.Group[];
};
export type VlsLoadout = "SM-2MR" | "SM-2ER" | "OTHER";
export type VlsCellState = {
  lid: THREE.Group;
  origin: THREE.Object3D;
  index: number;
  bank: "FWD" | "AFT";
  phase: "ready" | "opening" | "launching" | "closing" | "spent" | "disabled";
  closeTo: "ready" | "spent" | "disabled";
  phaseSince: number;
  pending: LauncherRequest | null;
  loadout: VlsLoadout;
};
export type VlsBankState = {
  lastLaunchAt: number;
  lastCellIndex: number;
  minimumObservedGap: number;
  launchHistory: number[];
  damageCenters: number[];
  trappedRounds: number;
};

export type Explosion = {
  core: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  age: number;
};
export type ShipDamageEffect = {
  group: THREE.Group;
  fire: THREE.Mesh;
  smoke: THREE.Mesh[];
  light: THREE.PointLight;
  seed: number;
};
export type BoosterDebris = {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  light: THREE.PointLight;
  age: number;
};
export type ChaffCloud = {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  rcs: number;
  initialRcs: number;
  source: Missile | null;
  side: "threat" | "ship" | "platform";
  serial: number;
};
export type SrbocRound = {
  mesh: THREE.Group;
  trail: THREE.Line;
  start: THREE.Vector3;
  control: THREE.Vector3;
  burst: THREE.Vector3;
  burstVelocity: THREE.Vector3;
  age: number;
  flightTime: number;
};
export type VlsLaunchEffect = {
  group: THREE.Group;
  flame: THREE.Mesh;
  smoke: THREE.Mesh[];
  light: THREE.PointLight;
  age: number;
};
export type EngagementDoctrine = "SINGLE" | "DOUBLE" | "SSLS";
export type EngagementState = {
  shots: number;
  pending: number;
  misses: number;
  lastResolution: number;
};
export type IlluminatorState = {
  id: number;
  azimuth: number;
  target: Interceptor | null;
  lastTargetId: number | string;
};
export type AarCategory =
  | "sensor"
  | "fire"
  | "guidance"
  | "effect"
  | "maneuver"
  | "network"
  | "system";
export type AarEvent = { time: number; text: string; category: AarCategory };
export type AarKinematics = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  verticalSpeed: number;
};
export type AarDatalinkNode = {
  id: string;
  network: "link11" | "link16";
  x: number;
  y: number;
  z: number;
  role: "ncs" | "participant";
  terminalHealth: number;
  transmitEnabled: boolean;
  receiveEnabled: boolean;
};
export type AarDatalinkTrack = {
  id: string;
  network: "link11" | "link16";
  x: number;
  y: number;
  z: number;
  classification: "unknown" | "aircraft" | "ship";
  quality: number;
  uncertainty: number;
  age: number;
  senderId?: string;
};
export type AarDatalinkSnapshot = {
  era: string;
  enabled: boolean;
  link11Ncs: string | null;
  link11CycleSeconds: number;
  nodes: AarDatalinkNode[];
  tracks: AarDatalinkTrack[];
};
export type AarSovietC2Snapshot = {
  era: string;
  enabled: boolean;
  nodes: Array<{ id: string; kind: "gci-controller" | "fleet-command"; label: string; x: number; y: number; z: number; operational: boolean }>;
  gciCommands: Array<{ id: string; participantId: string; controllerTrackId: string; x: number; y: number; z: number; quality: number; uncertainty: number; commandedSpeed: number; radarActivationRange: number; commandMode: "voice" | "automated"; expiresAt: number }>;
  maritimeAreas: Array<{ id: string; participantId: string; reportTrackId: string; source: "uspekh-u" | "legenda"; x: number; y: number; z: number; uncertaintyMajor: number; uncertaintyMinor: number; uncertaintyBearing: number; quality: number; expiresAt: number }>;
  fleetOrders: Array<{ id: string; participantId: string; commandNodeId: string; sourceReportTrackId: string; x: number; y: number; z: number; attackWindowStart: number; attackWindowEnd: number; expiresAt: number }>;
  salvoAssignments: Array<{ id: string; waveId: string; participantId: string; sourceOrderId: string; sourceReportTrackId: string; sequence: number; total: number; releaseAt: number; plannedArrivalAt: number; x: number; y: number; z: number; expiresAt: number }>;
};
export type AarFleetSnapshot = {
  id: string;
  datalinkEra: string;
  link11Enabled: boolean;
  formation: string;
  members: Array<{
    id: string; name: string; hullNumber: string; side: "blue" | "red";
    x: number; y: number; z: number; heading: number; speedKnots: number;
    hull: number; alive: boolean; formationRole: string; commandRoles: string[];
    stationStatus: string; stationError: number;
    magazines: { rim67: number; sm2mr: number; sm2er: number };
    localTracks: number; networkTracks: number;
    commsConnected: boolean; lostCommsDoctrine: string;
    bestObservedTrack?: {
      id: string; source: string; classification: string;
      quality: number; uncertainty: number; age: number;
      weaponAuthority: boolean;
    };
  }>;
  tracks: Array<{ id: string; x: number; y: number; z: number; classification: string; quality: number; uncertainty: number; age: number; contributors: string[]; weaponAuthority: false }>;
  assignments: Array<{ id: string; targetId: string; shooterId: string; localTrackId: string; weapon: string; requestedShots: number; weaponsAway: number; status: string; rejectionReason?: string; updatedAt: number }>;
  engagements: Array<{ targetId: string; shooters: string[]; weaponsCommitted: number; estimatedPk: number; status: string; updatedAt: number }>;
  physicalLaunches?: Array<{ shipId: string; launcherLabel: string; launchPoint: string; weapon: string; time: number }>;
};
export type AarAewCommand = {
  id:string; controllerId:string; participantId:string; controllerTrackId:string;
  mode:"link4a"|"voice-gci"; x:number; y:number; z:number;
  quality:number; uncertainty:number; commandedSpeed:number;
  radarActivationRange:number; expiresAt:number;
};
export type AarDecisionAuditRecord = {
  platformId: string;
  side: "blue" | "red";
  domain: "air" | "surface";
  action: string;
  reason: string;
  targetId: string | null;
  trackSource: string;
  trackQuality: number;
  localTrackCount: number;
  networkTrackCount: number;
  commsState: "connected" | "lost";
  doctrine: string;
  bestTrackId?: string;
  trackClassification?: string;
  trackUncertainty?: number;
  trackAge?: number;
  weaponAuthority?: boolean;
};
export type AarSnapshot = {
  time: number;
  ship: AarKinematics & { hull: number };
  missiles: (AarKinematics & {
    id: number;
    phase: MissilePhase;
    threatType: EnemyType;
    parentId?: string;
  })[];
  interceptors: (AarKinematics & {
    id: number;
    weapon: WeaponType;
    targetId: number | string;
    shooterId?: string;
  })[];
  chaff: (AarKinematics & {
    id: number;
    side: "threat" | "ship" | "platform";
  })[];
  enemyPlatform: (AarKinematics & {
    hull: number;
    destroyed: boolean;
    name: string;
  }) | null;
  surfaceStrikes: (AarKinematics & {
    id: number;
    phase: "boost" | "midcourse" | "terminal" | "penetrating" | "destroyed";
    targetId?: string;
  })[];
  aircraft: (AarKinematics & {
    id: string;
    name: string;
    side: "blue" | "red";
    state: string;
    mission: string;
    alive: boolean;
    structure: number;
    targetId: string | null;
    localTracks: number;
    networkTracks: number;
    bestTrackSource: string;
    bestTrackQuality: number;
    lostCommsDoctrine: string;
    tacticalState: string;
    sovietSeadState?: string;
    sovietSeadRole?: string;
    sovietSeadEmitter?: string;
    sovietSeadCueQuality?: number;
  })[];
  airWeapons: (AarKinematics & {
    id: string;
    name: string;
    side: "blue" | "red";
    phase: string;
    targetId: string;
    shooterId: string;
    seekerAcquired: boolean;
    midcourseLastUpdateAt: number;
    midcourseTrackQuality: number;
    midcourseUncertainty: number;
    midcourseLinkLostSeconds: number;
    inertialContinuation: boolean;
    autonomousSearchAuthorized: boolean;
    midcourseSource: string;
    armSeekerMode?: string;
    targetEmitterId?: string;
    armMemoryExpiresAt?: number;
  })[];
  airDecoys: (AarKinematics & {
    id: string;
    type: "chaff" | "flare";
    alive: boolean;
    side: "blue" | "red";
  })[];
  datalink?: AarDatalinkSnapshot;
  sovietC2?: AarSovietC2Snapshot;
  fleet?: AarFleetSnapshot;
  aewCommands?: AarAewCommand[];
  decisions?: AarDecisionAuditRecord[];
  spaceWeather?: {
    phase: string; intensity: number; hfAvailability: number; vhfUhfReliability: number;
    satelliteReliability: number; gnssQuality: number; radarNoise: number;
    magneticDisturbance: number; communicationWindowOpen: boolean;
    communicationWindowStrength: number;
  };
};
