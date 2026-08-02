import { spaceWeatherPreset } from "./catalog.js";
import type { SpaceWeatherKeyframe, SpaceWeatherPreset, SpaceWeatherPresetId, SpaceWeatherSnapshot } from "./types.js";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolate(left: SpaceWeatherKeyframe, right: SpaceWeatherKeyframe, time: number) {
  const span = Math.max(.0001, right.at - left.at);
  const t = clamp01((time - left.at) / span);
  return {
    intensity: lerp(left.intensity, right.intensity, t),
    hfAvailability: lerp(left.hfAvailability, right.hfAvailability, t),
    vhfUhfReliability: lerp(left.vhfUhfReliability, right.vhfUhfReliability, t),
    satelliteReliability: lerp(left.satelliteReliability, right.satelliteReliability, t),
    gnssQuality: lerp(left.gnssQuality, right.gnssQuality, t),
    radarNoise: lerp(left.radarNoise, right.radarNoise, t),
    ionosphericScintillation: lerp(left.ionosphericScintillation, right.ionosphericScintillation, t),
    magneticDisturbance: lerp(left.magneticDisturbance, right.magneticDisturbance, t),
  };
}

export class SpaceWeatherTimelineRuntime {
  readonly preset: SpaceWeatherPreset;
  constructor(preset: SpaceWeatherPreset | SpaceWeatherPresetId = "TOTAL_BAND_DENIAL") {
    this.preset = typeof preset === "string" ? spaceWeatherPreset(preset) : preset;
    if (!this.preset.keyframes.length) throw new Error("Space-weather timeline requires keyframes");
  }

  snapshotAt(inputTime: number): SpaceWeatherSnapshot {
    const time = Math.max(0, Math.min(this.preset.durationSeconds, inputTime));
    const frames = this.preset.keyframes;
    let index = frames.length - 1;
    for (let i = 0; i < frames.length; i++) if (frames[i].at <= time) index = i; else break;
    const active = frames[index];
    const next = frames[index + 1];
    const values = next ? interpolate(active, next, time) : interpolate(active, active, time);
    const window = this.preset.communicationWindows?.find(value => time >= value.start && time < value.end);
    if (window) {
      values.hfAvailability = Math.max(values.hfAvailability, window.strength * .72);
      values.vhfUhfReliability = Math.max(values.vhfUhfReliability, window.strength);
      values.satelliteReliability = Math.max(values.satelliteReliability, window.strength * .64);
    }
    return { presetId:this.preset.id, phase:active.phase, time, ...values,
      communicationWindowOpen:Boolean(window), nextTransitionAt:next?.at ?? null };
  }
}
