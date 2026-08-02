export type SpaceWeatherPhase =
  | "quiet"
  | "warning"
  | "solar-flare"
  | "degrading"
  | "total-blackout"
  | "intermittent"
  | "recovery";

export type SpaceWeatherPresetId =
  | "EXTREME_SPACE_WEATHER"
  | "TOTAL_BAND_DENIAL";

export type PropagationChannel =
  | "link11"
  | "link16"
  | "hf"
  | "vhf-uhf"
  | "satellite"
  | "soviet-gci"
  | "soviet-maritime-c2";

export interface SpaceWeatherSnapshot {
  presetId: SpaceWeatherPresetId;
  phase: SpaceWeatherPhase;
  time: number;
  intensity: number;
  hfAvailability: number;
  vhfUhfReliability: number;
  satelliteReliability: number;
  gnssQuality: number;
  radarNoise: number;
  ionosphericScintillation: number;
  magneticDisturbance: number;
  communicationWindowOpen: boolean;
  nextTransitionAt: number | null;
}

export interface SpaceWeatherKeyframe {
  at: number;
  phase: SpaceWeatherPhase;
  intensity: number;
  hfAvailability: number;
  vhfUhfReliability: number;
  satelliteReliability: number;
  gnssQuality: number;
  radarNoise: number;
  ionosphericScintillation: number;
  magneticDisturbance: number;
}

export interface SpaceWeatherPreset {
  id: SpaceWeatherPresetId;
  label: string;
  durationSeconds: number;
  keyframes: readonly SpaceWeatherKeyframe[];
  communicationWindows?: readonly { start: number; end: number; strength: number }[];
}

export interface PropagationContext {
  channel: PropagationChannel;
  messageId: string;
  senderId: string;
  recipientId: string;
  baseQuality?: number;
  baseDelaySeconds?: number;
  baseSuccessProbability?: number;
  rangeRatio?: number;
}

export interface PropagationEffect {
  channel: PropagationChannel;
  available: boolean;
  qualityMultiplier: number;
  delaySeconds: number;
  successProbability: number;
  dropped: boolean;
  clockErrorSeconds: number;
  uncertaintyMultiplier: number;
  reason: "nominal" | "degraded" | "space-weather-loss" | "out-of-range";
}
