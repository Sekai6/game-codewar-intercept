import type * as THREE from "three";
import type { TargetableEntity } from "../combat-entity.js";
import type { EngagementRecord } from "../defense/engagement.js";
import type { ShipDefinition, ShipManeuverMode, ShipWeapon, SubsystemId } from "../ship-types.js";

export interface ShipTrackEstimate {
  targetId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  uncertainty: number;
  classification: "unknown" | "aircraft" | "ship" | "missile";
  source: "local-radar" | "link11" | "link16";
  updatedAt: number;
  weaponQuality: boolean;
  contributors?: string[];
}

export interface ShipMagazineState {
  rounds: Map<ShipWeapon, number>;
  ciws: number;
  surfaceStrike: number;
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
  magazines: ShipMagazineState;
  localTracks: Map<string, ShipTrackEstimate>;
  networkTracks: Map<string, ShipTrackEstimate>;
  engagements: Map<string, EngagementRecord>;
  launcherChannels: number;
  illuminatorChannels: number;
}
