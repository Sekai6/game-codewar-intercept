import { spaceWeatherPreset } from "./catalog.js";
import type { SpaceWeatherKeyframe, SpaceWeatherPreset, SpaceWeatherPresetId, SpaceWeatherSnapshot } from "./types.js";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SpaceWeatherPhaseScheduleEntry {
  at: number;
  phase: SpaceWeatherKeyframe["phase"];
}

/**
 * Retimes preset phase starts without discarding additional keyframes inside a
 * phase. This matters for recovery curves, which commonly have both a recovery
 * start and a later steady-state endpoint under the same phase name.
 */
export function retimeSpaceWeatherKeyframes(
  preset: SpaceWeatherPreset,
  schedule: readonly SpaceWeatherPhaseScheduleEntry[],
  durationSeconds = preset.durationSeconds,
): SpaceWeatherKeyframe[] {
  if (!schedule.length) return preset.keyframes
    .filter((frame) => frame.at <= durationSeconds)
    .map((frame) => ({ ...frame }));

  const frames: SpaceWeatherKeyframe[] = [];
  const ordered = [...schedule].sort((a, b) => a.at - b.at);
  for (let scheduleIndex = 0; scheduleIndex < ordered.length; scheduleIndex++) {
    const entry = ordered[scheduleIndex];
    const sourceIndex = preset.keyframes.findIndex((frame) => frame.phase === entry.phase);
    if (sourceIndex < 0) throw new Error(`Preset ${preset.id} has no values for phase ${entry.phase}`);
    const sourceStart = preset.keyframes[sourceIndex];
    const nextScheduledAt = ordered[scheduleIndex + 1]?.at ?? Number.POSITIVE_INFINITY;
    for (let index = sourceIndex; index < preset.keyframes.length; index++) {
      const source = preset.keyframes[index];
      if (source.phase !== entry.phase) break;
      const at = entry.at + (source.at - sourceStart.at);
      if (at > durationSeconds || at >= nextScheduledAt) break;
      frames.push({ ...source, at });
    }
  }
  return frames;
}

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
    return { presetId:this.preset.id, scenarioSeed:this.preset.scenarioSeed, phase:active.phase, time, ...values,
      communicationWindowOpen:Boolean(window), communicationWindowStrength:window?.strength ?? 0,
      nextTransitionAt:next?.at ?? null };
  }
}
