import * as THREE from "three";
import type { ScenarioZoneDefinition } from "../scenario-system/types.js";

export interface LocalWeatherEffect {
  zoneIds: readonly string[];
  intensity: number;
  visibilityKm: number;
  radarRangeFactor: number;
  detectionProbabilityFactor: number;
  measurementNoiseFactor: number;
  turbulence: number;
}

export interface WeatherFrontSnapshot {
  id: string;
  center: THREE.Vector3;
  radius: number;
  intensity: number;
  cloudBase: number;
  cloudTop: number;
}

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);

export class WeatherFrontRuntime {
  private readonly fronts: readonly ScenarioZoneDefinition[];
  constructor(zones: readonly ScenarioZoneDefinition[], readonly seed: number) {
    this.fronts = zones.filter((zone) => zone.kind === "weather-front" && zone.weather);
  }

  snapshotsAt(time: number): WeatherFrontSnapshot[] {
    return this.fronts.map((front, index) => {
      const center = new THREE.Vector3(...front.center);
      if (front.motion) {
        center.addScaledVector(new THREE.Vector3(...front.motion.velocity), time);
        const wave = front.motion.oscillation;
        if (wave) {
          const phase = ((this.seed ^ ((index + 1) * 2654435761)) >>> 0) / 0xffffffff * Math.PI * 2;
          center.addScaledVector(new THREE.Vector3(...wave.axis).normalize(), Math.sin(time / wave.periodSeconds * Math.PI * 2 + phase) * wave.amplitude);
        }
      }
      return { id:front.id, center, radius:front.radius, intensity:front.weather!.intensity, cloudBase:front.weather!.cloudBase, cloudTop:front.weather!.cloudTop };
    });
  }

  effectAt(position: THREE.Vector3, time: number): LocalWeatherEffect {
    let combined = 0, visibilityKm = Infinity, radarAttenuation = 0, noise = 0, turbulence = 0;
    const zoneIds: string[] = [];
    for (const front of this.fronts) {
      const snapshot = this.snapshotsAt(time).find((candidate) => candidate.id === front.id)!;
      const distance = Math.hypot(position.x - snapshot.center.x, position.z - snapshot.center.z);
      const horizontal = clamp01(1 - distance / snapshot.radius);
      const vertical = position.y < snapshot.cloudBase
        ? clamp01(1 - (snapshot.cloudBase - position.y) / 30)
        : position.y > snapshot.cloudTop
          ? clamp01(1 - (position.y - snapshot.cloudTop) / 35)
          : 1;
      const weight = horizontal * horizontal * (3 - 2 * horizontal) * vertical * front.weather!.intensity;
      if (weight <= .01) continue;
      zoneIds.push(front.id);
      combined = 1 - (1 - combined) * (1 - weight);
      visibilityKm = Math.min(visibilityKm, THREE.MathUtils.lerp(80, front.weather!.visibilityKm, weight));
      radarAttenuation = Math.max(radarAttenuation, front.weather!.radarAttenuation * weight);
      noise = Math.max(noise, front.weather!.measurementNoise * weight);
      turbulence = Math.max(turbulence, front.weather!.turbulence * weight);
    }
    return {
      zoneIds, intensity:combined, visibilityKm:Number.isFinite(visibilityKm) ? visibilityKm : 80,
      radarRangeFactor:1 - radarAttenuation * .42,
      detectionProbabilityFactor:1 - radarAttenuation * .28,
      measurementNoiseFactor:1 + noise * 1.8,
      turbulence,
    };
  }
}
