import * as THREE from "three";
import type { CombatEntity } from "../combat-entity.js";
import type { EmissionState, PassiveSensorDefinition, PassiveTrackData } from "./passive-types.js";

export interface PassiveObservation extends PassiveTrackData { targetId: string; position: THREE.Vector3; velocity: THREE.Vector3; quality: number; uncertainty: number; lastUpdate: number; classification: "unknown"|"aircraft"|"ship"; }

const deg = 180 / Math.PI;
function bearing(from: THREE.Vector3, to: THREE.Vector3) { return Math.atan2(to.x - from.x, -(to.z - from.z)) * deg; }
function angularDifference(a: number, b: number) { return Math.abs(((a - b + 180) % 360 + 360) % 360 - 180); }

export function observePassive(input: { sensor: PassiveSensorDefinition; observer: CombatEntity; target: CombatEntity; emission?: EmissionState; time: number; noise: readonly [number, number, number]; }): PassiveObservation | undefined {
  const { sensor, observer, target } = input;
  if (!sensor.detects.includes(target.kind)) return undefined;
  const offset = target.position.clone().sub(observer.position), range = offset.length();
  if (range > sensor.range) return undefined;
  const signal = sensor.kind === "irst"
    ? target.infraredSignature / Math.max(1, (range / 100) ** 1.35)
    : (input.emission?.emissionStrength ?? 0) / Math.max(1, (range / 100) ** 1.15);
  if (signal < sensor.minimumSignal) return undefined;
  const b = bearing(observer.position, target.position);
  const measuredBearing = b + (input.noise[0] - .5) * sensor.bearingPrecisionDeg * 2;
  const estimatedRange = range * (1 + (input.noise[1] - .5) * sensor.rangeEstimateError * 2);
  const position = observer.position.clone().add(new THREE.Vector3(Math.sin(measuredBearing / deg) * estimatedRange, target.position.y - observer.position.y, -Math.cos(measuredBearing / deg) * estimatedRange));
  const quality = Math.max(.05, Math.min(.9, signal / Math.max(sensor.minimumSignal * 3, 1)));
  return { targetId: target.id, position, velocity: target.velocity.clone(), quality, uncertainty: Math.max(sensor.rangeEstimateError * range, sensor.bearingPrecisionDeg * range / 60), lastUpdate: input.time, classification: target.kind === "aircraft" || target.kind === "ship" ? target.kind : "unknown", source: sensor.kind, bearingDeg: measuredBearing, bearingUncertaintyDeg: sensor.bearingPrecisionDeg, rangeEstimate: estimatedRange, rangeUncertainty: Math.abs(estimatedRange - range) + sensor.rangeEstimateError * range, signalStrength: signal, emitterType: sensor.kind === "irst" ? "engine-heat" : (input.emission?.jammerEmitting ? "jammer" : "radar"), emitterId: sensor.kind === "esm" ? target.id : undefined, passiveOnly: true };
}

export function fusePassiveTracks(irst: PassiveObservation | undefined, esm: PassiveObservation | undefined): PassiveObservation | undefined {
  if (!irst && !esm) return undefined;
  if (!irst) return { ...esm!, source: "passive-fusion", quality: esm!.quality * .92, uncertainty: esm!.uncertainty * .9 };
  if (!esm) return { ...irst, source: "passive-fusion", quality: irst.quality * .92, uncertainty: irst.uncertainty * .9 };
  const weight = irst.quality / Math.max(.01, irst.quality + esm.quality);
  const position = irst.position.clone().multiplyScalar(weight).addScaledVector(esm.position, 1 - weight);
  return { ...irst, source: "passive-fusion", position, quality: Math.min(.95, (irst.quality + esm.quality) * .62), uncertainty: Math.min(irst.uncertainty, esm.uncertainty) * .72, emitterType: "radar" };
}
