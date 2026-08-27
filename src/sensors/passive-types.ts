import type { CombatEntity } from "../combat-entity.js";

export type PassiveSensorKind = "irst" | "esm";
export type EmconMode = "active" | "emcon" | "passive-only";
export type PassiveEmitterType = "radar" | "jammer" | "engine-heat" | "communication";

export interface PassiveSensorDefinition {
  id: string;
  kind: PassiveSensorKind;
  range: number;
  fieldOfViewDeg: number;
  updateInterval: number;
  bearingPrecisionDeg: number;
  rangeEstimateError: number;
  minimumSignal: number;
  detects: readonly CombatEntity["kind"][];
}

export interface PassiveSensorSuite { irst?: PassiveSensorDefinition; esm?: PassiveSensorDefinition; }

export interface EmissionState {
  radarEmitting: boolean;
  communicationEmitting: boolean;
  jammerEmitting: boolean;
  emissionStrength: number;
}

export interface PassiveTrackData {
  source: PassiveSensorKind | "passive-fusion";
  bearingDeg: number;
  bearingUncertaintyDeg: number;
  rangeEstimate?: number;
  rangeUncertainty?: number;
  signalStrength: number;
  emitterType?: PassiveEmitterType;
  emitterId?: string;
  passiveOnly: true;
}
