import type * as THREE from "three";

export type ArmEmitterType = "search-radar" | "fire-control-radar" | "datalink" | "jammer";
export type ArmSeekerMode = "emitter-search" | "emitter-acquired" | "terminal-home" | "memory-track" | "reacquisition" | "lost" | "impact" | "miss";

export interface EmitterDefinition {
  id: string; name: string; emitterType: ArmEmitterType; band: string;
  nominalPower: number; detectionSignature: number; frequencyAgility: number;
  shutdownDelay: number; restartDelay: number;
}
export interface EmitterInstance {
  id: string; platformId: string; definitionId: string; position: THREE.Vector3;
  active: boolean; mode: "search" | "track" | "guidance" | "jam";
  emissionStrength: number; lastActivatedAt: number; lastDeactivatedAt: number;
  shutdownUntil?: number; health: number; decoy: boolean;
}
export interface EmitterTrack {
  id: string; emitterId?: string; observerId: string; bearingDeg: number;
  bearingUncertaintyDeg: number; estimatedRange?: number; rangeUncertainty?: number;
  band: string; emitterType: ArmEmitterType; signalStrength: number; quality: number;
  lastUpdateAt: number; lastKnownPosition: THREE.Vector3; memoryExpiresAt?: number;
  source: "local-esm" | "datalink-cue" | "passive-fusion";
}
export interface ArmWeaponProfile {
  id: "AGM-45A" | "AGM-88A"; seekerBands: readonly string[]; seekerRange: number;
  seekerFovDeg: number; memoryDuration: number; reacquisitionWindow: number;
  homeOnJam: boolean; shutdownBehavior: "memory-only" | "memory-and-reacquire";
  seekerUpdateInterval: number;
}
export interface ArmSeekerState {
  mode: ArmSeekerMode; targetEmitterId?: string; lastKnownPosition?: THREE.Vector3;
  lastSignalAt?: number; memoryExpiresAt?: number; reacquisitionUntil?: number;
}
