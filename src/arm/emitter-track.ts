import * as THREE from "three";
import type { EmitterInstance, EmitterTrack } from "./types.js";
export function createEmitterTrack(input:{observerId:string; emitter:EmitterInstance; observerPosition:THREE.Vector3; time:number; quality:number; source?:EmitterTrack["source"]}):EmitterTrack {
  const delta=input.emitter.position.clone().sub(input.observerPosition);
  return { id:`ARM-${input.observerId}-${input.emitter.id}`, emitterId:input.emitter.id, observerId:input.observerId, bearingDeg:THREE.MathUtils.radToDeg(Math.atan2(delta.x,-delta.z)), bearingUncertaintyDeg:Math.max(1, (1-input.quality)*12), estimatedRange:delta.length(), rangeUncertainty:delta.length()*(1-input.quality)*.4, band:"", emitterType:"search-radar", signalStrength:input.emitter.emissionStrength, quality:input.quality, lastUpdateAt:input.time, lastKnownPosition:input.emitter.position.clone(), source:input.source??"local-esm" };
}
