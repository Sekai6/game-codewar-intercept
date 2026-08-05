import type { PropagationSpatialZone, SpaceWeatherSnapshot } from "./types.js";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface SpatialWeatherResult {
  snapshot: SpaceWeatherSnapshot;
  activeZoneIds: readonly string[];
  disturbanceWeight: number;
  windowWeight: number;
}

/** Applies deterministic local propagation modifiers without mutating the timeline snapshot. */
export function applySpatialWeather(
  snapshot: SpaceWeatherSnapshot,
  positions: readonly (readonly [number, number, number])[],
  zones: readonly PropagationSpatialZone[] = [],
): SpatialWeatherResult {
  const weights = zones.map((zone) => {
    const nearest = positions.length ? Math.min(...positions.map((position) => distance(position, zone.center))) : Infinity;
    return { zone, weight: clamp01(1 - nearest / Math.max(1, zone.radius)) };
  }).filter((entry) => entry.weight > 0);
  const disturbanceWeight = Math.max(0, ...weights.filter((entry) => entry.zone.kind === "magnetic-disturbance").map((entry) => entry.weight));
  const windowWeight = snapshot.communicationWindowOpen
    ? Math.max(0, ...weights.filter((entry) => entry.zone.kind === "comms-window").map((entry) => entry.weight))
    : 0;
  const windowStrength = snapshot.communicationWindowStrength * windowWeight;
  const reliabilityPenalty = 1 - disturbanceWeight * snapshot.magneticDisturbance * .34;
  const localized: SpaceWeatherSnapshot = {
    ...snapshot,
    magneticDisturbance: clamp01(snapshot.magneticDisturbance + disturbanceWeight * .18),
    ionosphericScintillation: clamp01(snapshot.ionosphericScintillation + disturbanceWeight * .12),
    hfAvailability: Math.max(snapshot.hfAvailability * reliabilityPenalty, windowStrength * .72),
    vhfUhfReliability: Math.max(snapshot.vhfUhfReliability * reliabilityPenalty, windowStrength),
    satelliteReliability: Math.max(snapshot.satelliteReliability * reliabilityPenalty, windowStrength * .64),
  };
  return { snapshot: localized, activeZoneIds: weights.map((entry) => entry.zone.id), disturbanceWeight, windowWeight };
}
