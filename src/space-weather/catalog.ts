import type { SpaceWeatherKeyframe, SpaceWeatherPreset, SpaceWeatherPresetId } from "./types.js";

const frame = (
  at: number, phase: SpaceWeatherKeyframe["phase"], intensity: number,
  hfAvailability: number, vhfUhfReliability: number, satelliteReliability: number,
  gnssQuality: number, radarNoise: number, ionosphericScintillation: number,
  magneticDisturbance: number,
): SpaceWeatherKeyframe => ({ at, phase, intensity, hfAvailability,
  vhfUhfReliability, satelliteReliability, gnssQuality, radarNoise,
  ionosphericScintillation, magneticDisturbance });

export const SPACE_WEATHER_PRESETS: Readonly<Record<SpaceWeatherPresetId, SpaceWeatherPreset>> = {
  EXTREME_SPACE_WEATHER: {
    id: "EXTREME_SPACE_WEATHER", label: "Extreme Space Weather", durationSeconds: 1080,
    keyframes: [
      frame(0, "quiet", .05, .98, .99, .98, .99, .03, .04, .04),
      frame(150, "warning", .22, .78, .92, .88, .90, .09, .22, .25),
      frame(210, "solar-flare", .60, .38, .72, .50, .62, .18, .62, .68),
      frame(260, "degrading", .72, .25, .58, .34, .48, .23, .74, .80),
      frame(300, "total-blackout", .82, .16, .48, .24, .38, .28, .82, .88),
      frame(720, "intermittent", .68, .32, .61, .38, .54, .22, .66, .72),
      frame(960, "recovery", .30, .68, .84, .72, .82, .11, .32, .36),
      frame(1080, "recovery", .16, .84, .93, .87, .92, .07, .18, .20),
    ],
    communicationWindows: [
      { start: 748, end: 766, strength: .58 },
      { start: 824, end: 850, strength: .66 },
      { start: 914, end: 929, strength: .74 },
    ],
  },
  TOTAL_BAND_DENIAL: {
    id: "TOTAL_BAND_DENIAL", label: "Total Band Denial", durationSeconds: 1080,
    keyframes: [
      frame(0, "quiet", .05, .98, .99, .98, .99, .03, .04, .04),
      frame(150, "warning", .30, .62, .82, .72, .79, .12, .32, .35),
      frame(210, "solar-flare", .76, .16, .38, .18, .36, .25, .78, .82),
      frame(260, "degrading", .91, .06, .18, .07, .19, .34, .91, .95),
      frame(300, "total-blackout", 1, .015, .07, .025, .10, .40, .98, 1),
      frame(720, "intermittent", .82, .18, .31, .16, .32, .29, .78, .84),
      frame(960, "recovery", .42, .53, .70, .58, .68, .15, .43, .48),
      frame(1080, "recovery", .20, .78, .89, .82, .88, .08, .23, .25),
    ],
    communicationWindows: [
      { start: 748, end: 766, strength: .50 },
      { start: 824, end: 850, strength: .58 },
      { start: 914, end: 929, strength: .66 },
    ],
  },
};

export function spaceWeatherPreset(id: SpaceWeatherPresetId): SpaceWeatherPreset {
  return SPACE_WEATHER_PRESETS[id];
}
