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
  station?: readonly [number, number, number];
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
  assignmentIds: string[];
  assignedShooters: string[];
  weaponsCommitted: number;
  estimatedPk: number;
  expectedInterceptTimes: number[];
  assessmentDueAt: number;
  lastUpdatedAt: number;
  resolvedAt?: number;
  status: "assigned" | "weapons-away" | "assessing" | "leaker" | "resolved";
}

export interface ForceEngagementAssignment {
  id: string;
  forceTrackId: string;
  shooterId: string;
  localTrackId: string;
  weapon: ShipWeapon;
  requestedShots: number;
  threatScore: number;
  estimatedTimeToImpact: number;
  assignedAt: number;
  expiresAt: number;
  status: "assigned" | "accepted" | "rejected" | "expired" | "weapons-away";
  updatedAt: number;
  weaponsAwayCount?: number;
  rejectionReason?: string;
}

export interface SurfaceStrikeAssignment {
  id: string;
  targetId: string;
  shooterId: string;
  localTrackId: string;
  requestedWeapons: number;
  quality: number;
  assignedAt: number;
  status: "assigned" | "accepted" | "launched" | "rejected" | "expired";
  rejectionReason?: string;
}

export interface FleetStationState {
  desiredPosition: readonly [number, number, number];
  errorDistance: number;
  status: "on-station" | "maneuvering" | "straggling" | "disabled";
}

export interface FleetFormationState {
  anchorShipId: string;
  heading: number;
  speedKnots: number;
  stations: Map<string, FleetStationState>;
  lastCommandReassessmentAt: number;
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
  formationState: FleetFormationState;
  picture: Map<string, ShipTrackEstimate>;
  assignments: Map<string, ForceEngagementAssignment>;
  engagements: Map<string, ForceEngagementRecord>;
  surfaceAssignments: Map<string, SurfaceStrikeAssignment>;
}
