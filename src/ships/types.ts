import type * as THREE from "three";
import type { TargetableEntity } from "../combat-entity.js";
import type { EngagementRecord } from "../defense/engagement.js";
import type { ShipDefinition, ShipManeuverMode, ShipWeapon, SubsystemId } from "../ship-types.js";
import type { EmconMode } from "../sensors/passive-types.js";
import type { PassiveObservation } from "../sensors/passive-runtime.js";

export interface ShipTrackEstimate {
  targetId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  uncertainty: number;
  classification: "unknown" | "aircraft" | "ship" | "missile";
  source: "local-radar" | "link11" | "link16" | "esm" | "passive-fusion";
  passive?: PassiveObservation;
  updatedAt: number;
  weaponQuality: boolean;
  contributors?: string[];
}

export interface ShipMagazineState {
  rounds: Map<ShipWeapon, number>;
  ciws: number;
  surfaceStrike: number;
}

export interface ShipRadarDecoy {
  id: string;
  sourceShipId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  lifeSeconds: number;
  radarCrossSection: number;
  alive: boolean;
}

export interface ShipElectronicWarfareState {
  ecmEnabled: boolean;
  decoyEnabled: boolean;
  ecmStrength: number;
  burnThroughRange: number;
  decoyRounds: number;
  decoyCooldownSeconds: number;
  decoyDeployRange: number;
  decoyRcs: number;
  decoyLifeSeconds: number;
  nextDecoyAt: number;
  decoys: ShipRadarDecoy[];
}

export interface ShipDamageControlState {
  fireIntensity: number;
  flooding: number;
  damageControlCapacity: number;
  lastImpactAt: number;
  casualtyCount: number;
}

export interface ShipCombatantInstance extends TargetableEntity {
  kind: "ship";
  definition: ShipDefinition;
  forceId: string;
  model: THREE.Group;
  heading: number;
  speedKnots: number;
  commandedSpeedKnots: number;
  maneuverMode: ShipManeuverMode;
  hullIntegrity: number;
  subsystemHealth: Map<SubsystemId, number>;
  damageControl: ShipDamageControlState;
  magazines: ShipMagazineState;
  electronicWarfare: ShipElectronicWarfareState;
  localTracks: Map<string, ShipTrackEstimate>;
  networkTracks: Map<string, ShipTrackEstimate>;
  engagements: Map<string, EngagementRecord>;
  launcherChannels: number;
  illuminatorChannels: number;
  emconMode: EmconMode;
  passiveTracks: Map<string, PassiveObservation>;
  nextPassiveScan: number;
}
