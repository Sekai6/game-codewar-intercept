import type * as THREE from "three";
import type { CombatSide } from "../combat-entity.js";

export type TacticalTrackClassification =
  | "unknown"
  | "aircraft"
  | "ship"
  | "missile";

export interface Link16TrackReport {
  messageId: string;
  trackId: string;
  senderId: string;
  side: CombatSide;
  originSensorId: string;
  observationId: string;
  relayChain: readonly string[];
  observedAt: number;
  transmittedAt: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  classification: TacticalTrackClassification;
  targetRole?: "fighter" | "bomber" | "attack" | "aew";
  quality: number;
  uncertainty: number;
  priority: "routine" | "threat" | "emergency";
  sensorMode?: "active-radar" | "irst" | "esm" | "passive-fusion";
  passive?: boolean;
  bearingOnly?: boolean;
  rangeEstimate?: number;
  rangeUncertainty?: number;
  passiveBearingDeg?: number;
  passiveBearingUncertaintyDeg?: number;
  passiveSignalStrength?: number;
  passiveEmitterType?: "radar" | "jammer" | "engine-heat" | "communication";
  passiveEmitterId?: string;
}

export interface Link16ParticipantState {
  id: string;
  side: CombatSide;
  position: THREE.Vector3;
  alive: boolean;
  terminalHealth: number;
  timeSyncQuality: number;
  transmitEnabled: boolean;
  receiveEnabled: boolean;
}

export interface Link16Delivery {
  recipientId: string;
  report: Link16TrackReport;
  receivedAt: number;
  networkDelay: number;
}

export interface Link16Diagnostics {
  queued: number;
  transmitted: number;
  delivered: number;
  droppedCapacity: number;
  droppedLink: number;
  droppedDuplicate: number;
  meanDelay: number;
}

export interface Link11Diagnostics extends Link16Diagnostics {
  rollCalls: number;
  netControlStation: string | null;
  cycleSeconds: number;
}

export type TacticalNetworkKind = "link11" | "link16";
export interface TacticalNetworkActivity {
  id: string;
  network: TacticalNetworkKind;
  kind: "poll" | "transmit" | "deliver" | "drop";
  time: number;
  senderId: string;
  recipientId?: string;
  trackId?: string;
  delay?: number;
  reason?: "out-of-range" | "space-weather-loss" | "localized-disturbance" | "link-quality" | "capacity" | "duplicate";
}
