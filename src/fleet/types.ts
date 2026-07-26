import type { CombatSide } from "../combat-entity.js";
import type { DatalinkEra } from "../datalink/era.js";
import type { ShipWeapon } from "../ship-types.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "../ships/types.js";

export type FleetFormation = "screen" | "line-abreast" | "column" | "dispersed";
export type FleetFormationRole = "command" | "picket" | "screen" | "escort" | "hvu";
export type FleetCommandRole = "otc" | "aawc" | "asuwc";

export interface FleetDoctrine {
  id: string;
  label: string;
  networkTracksProvideWeaponAuthority: boolean;
  requireLocalFireControlTrack: boolean;
  commandReassessmentSeconds: number;
  reserveFraction: number;
}

export interface FleetShipScenarioEntry {
  instanceId: string;
  definitionId: string;
  position: readonly [number, number, number];
  heading: number;
  station: readonly [number, number, number];
  formationRole: FleetFormationRole;
  commandRoles: readonly FleetCommandRole[];
  initialSpeedKnots?: number;
  loadout?: Partial<Record<ShipWeapon | "ciws" | "surfaceStrike", number>>;
}

export interface NavalForceScenario {
  id: string;
  label: string;
  side: CombatSide;
  doctrineId: string;
  datalinkEra: DatalinkEra;
  formation: FleetFormation;
  ships: readonly FleetShipScenarioEntry[];
}

export interface ForceEngagementRecord {
  targetId: string;
  assignedShooters: string[];
  weaponsCommitted: number;
  estimatedPk: number;
  expectedInterceptTimes: number[];
  assessmentDueAt: number;
  status: "assigned" | "weapons-away" | "assessing" | "leaker";
}

export interface NavalForceRuntime {
  id: string;
  side: CombatSide;
  doctrine: FleetDoctrine;
  datalinkEra: DatalinkEra;
  formation: FleetFormation;
  ships: Map<string, ShipCombatantInstance>;
  stations: Map<string, readonly [number, number, number]>;
  formationRoles: Map<string, FleetFormationRole>;
  commandRoles: Map<FleetCommandRole, string>;
  picture: Map<string, ShipTrackEstimate>;
  engagements: Map<string, ForceEngagementRecord>;
}

