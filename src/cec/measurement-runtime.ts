import * as THREE from "three";
import type { CecMeasurement, CecMeasurementSource, Covariance6 } from "./types.js";
import { diagonalCovariance } from "./covariance.js";

export interface MeasurementInput { sourcePlatformId:string; sourceSensorId:string; targetId:string; position:THREE.Vector3; velocity:THREE.Vector3; classification:string; observedAt:number; sourceMode:CecMeasurementSource; quality?:number; timeSyncQuality?:number; covariance?:Covariance6; }
function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/0xffffffff;}
/** Converts an already-authorized local sensor report into a CEC measurement. Never scans or reads hidden target state. */
export function createCecMeasurement(input:MeasurementInput):CecMeasurement {
  const q=Math.max(0,Math.min(1,input.quality ?? .8)); const sync=Math.max(0,Math.min(1,input.timeSyncQuality ?? 1));
  const n=(axis:string)=>(hash(`${input.targetId}:${input.observedAt.toFixed(2)}:${axis}`)-.5);
  const p=input.position.clone(); const v=input.velocity.clone(); const error=Math.max(.001,1-q)*20;
  p.x+=n("x")*error; p.y+=n("y")*error*.4; p.z+=n("z")*error;
  return { id:`CEC-M-${input.sourcePlatformId}-${input.targetId}-${Math.round(input.observedAt*10)}`, sourcePlatformId:input.sourcePlatformId, sourceSensorId:input.sourceSensorId, targetId:input.targetId, observedAt:input.observedAt, position:p, velocity:v, altitude:p.y, covariance:input.covariance ?? diagonalCovariance(error*error, Math.max(1,error*.2)**2), quality:q, classification:input.classification, timeSyncQuality:sync, sourceMode:input.sourceMode };
}

export function ageCecMeasurement(measurement:CecMeasurement, now:number, staleAfter=12):CecMeasurement | undefined {
  if(now-measurement.observedAt>staleAfter) return undefined;
  return measurement;
}
