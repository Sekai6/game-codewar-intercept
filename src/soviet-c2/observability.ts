import type * as THREE from "three";
import type { SovietCommandEra } from "./era.js";
import type { SovietMaritimeSource } from "./maritime-targeting.js";

export interface SovietC2NodeView {
  id: string;
  kind: "gci-controller" | "fleet-command";
  label: string;
  position: THREE.Vector3;
  operational: boolean;
}

export interface SovietGciCommandView {
  id: string;
  participantId: string;
  participantPosition: THREE.Vector3;
  controllerTrackId: string;
  interceptPoint: THREE.Vector3;
  quality: number;
  uncertainty: number;
  commandedSpeed: number;
  radarActivationRange: number;
  commandMode: "voice" | "automated";
  deliveredAt: number;
  expiresAt: number;
}

export interface SovietMaritimeAreaView {
  id: string;
  participantId: string;
  reportTrackId: string;
  source: SovietMaritimeSource;
  estimatedPosition: THREE.Vector3;
  launchRegionCenter: THREE.Vector3;
  uncertaintyMajor: number;
  uncertaintyMinor: number;
  uncertaintyBearing: number;
  quality: number;
  deliveredAt: number;
  expiresAt: number;
}

export interface SovietFleetOrderView {
  id: string;
  participantId: string;
  participantPosition: THREE.Vector3;
  commandNodeId: string;
  sourceReportTrackId: string;
  approachPoint: THREE.Vector3;
  attackWindowStart: number;
  attackWindowEnd: number;
  deliveredAt: number;
  expiresAt: number;
}

export interface SovietSalvoAssignmentView {
  id: string;
  waveId: string;
  participantId: string;
  participantPosition: THREE.Vector3;
  sourceOrderId: string;
  sourceReportTrackId: string;
  sequence: number;
  total: number;
  releaseAt: number;
  plannedArrivalAt: number;
  expiresAt: number;
}

export interface SovietC2EventView {
  id: string;
  time: number;
  layer: "gci" | "maritime" | "fleet-command" | "salvo";
  text: string;
}

export interface SovietC2Observation {
  era: SovietCommandEra;
  enabled: boolean;
  nodes: readonly SovietC2NodeView[];
  gciCommands: readonly SovietGciCommandView[];
  maritimeAreas: readonly SovietMaritimeAreaView[];
  fleetOrders: readonly SovietFleetOrderView[];
  salvoAssignments: readonly SovietSalvoAssignmentView[];
  events: readonly SovietC2EventView[];
}
