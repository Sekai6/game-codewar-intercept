import * as THREE from "three";
import { AFTERNOON_SUN_DIRECTION } from "./sunlight";

export interface LightingEnvironmentPreset {
  id: "afternoon" | "polar-twilight";
  sunDirection: THREE.Vector3;
  sunAltitudeDeg: number;
  sunColor: number;
  sunIntensityLow: number;
  sunIntensityHigh: number;
  ambientSkyColor: number;
  ambientGroundColor: number;
  ambientIntensityLow: number;
  ambientIntensityHigh: number;
  fillColor: number;
  fillIntensityHigh: number;
  skyTopColor: number;
  skyHorizonColor: number;
  oceanDeepColor: number;
  oceanShallowColor: number;
  oceanSkyColor: number;
  fogColor: number;
  fogDensity: number;
  backgroundColor: number;
  exposure: number;
  indirectIntensity: number;
  nightMix: number;
}

const directionAt = (azimuthDeg: number, altitudeDeg: number) => {
  const azimuth = THREE.MathUtils.degToRad(azimuthDeg);
  const altitude = THREE.MathUtils.degToRad(altitudeDeg);
  return new THREE.Vector3(Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), Math.cos(azimuth) * Math.cos(altitude)).normalize();
};

export const AFTERNOON_ENVIRONMENT: LightingEnvironmentPreset = {
  id: "afternoon", sunDirection: AFTERNOON_SUN_DIRECTION.clone(), sunAltitudeDeg: 28,
  sunColor: 0xffd09a, sunIntensityLow: 2.5, sunIntensityHigh: 3.45,
  ambientSkyColor: 0x9dc9e8, ambientGroundColor: 0x17232a, ambientIntensityLow: 1.55, ambientIntensityHigh: 1.12,
  fillColor: 0x83b8dc, fillIntensityHigh: 0.62, skyTopColor: 0x173c68, skyHorizonColor: 0x7899ac,
  oceanDeepColor: 0x071f2d, oceanShallowColor: 0x176477, oceanSkyColor: 0x88b7d2,
  fogColor: 0x8298a4, fogDensity: 0.00072, backgroundColor: 0x06111b,
  exposure: 1.08, indirectIntensity: 0.28, nightMix: 0,
};

export const POLAR_TWILIGHT_ENVIRONMENT: LightingEnvironmentPreset = {
  id: "polar-twilight", sunDirection: directionAt(232, -6), sunAltitudeDeg: -6,
  sunColor: 0xcf8068, sunIntensityLow: 0.08, sunIntensityHigh: 0.12,
  ambientSkyColor: 0x45678f, ambientGroundColor: 0x07101c, ambientIntensityLow: 0.54, ambientIntensityHigh: 0.68,
  fillColor: 0x527ba8, fillIntensityHigh: 0.24, skyTopColor: 0x071329, skyHorizonColor: 0x294665,
  oceanDeepColor: 0x020d19, oceanShallowColor: 0x10384b, oceanSkyColor: 0x294963,
  fogColor: 0x1a2d43, fogDensity: 0.00042, backgroundColor: 0x040b18,
  exposure: 1.24, indirectIntensity: 0.13, nightMix: 0.88,
};

export function environmentPresetFor(timeOfDay?: string): LightingEnvironmentPreset {
  return timeOfDay === "polar-twilight" ? POLAR_TWILIGHT_ENVIRONMENT : AFTERNOON_ENVIRONMENT;
}
