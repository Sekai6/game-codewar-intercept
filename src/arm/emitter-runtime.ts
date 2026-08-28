import * as THREE from "three";
import type { EmitterDefinition, EmitterInstance } from "./types.js";

export class ArmEmitterRuntime {
  readonly emitters = new Map<string, EmitterInstance>();
  register(input:{id:string; platformId:string; definition:EmitterDefinition; position:THREE.Vector3; time?:number; decoy?:boolean}) {
    const time=input.time??0;
    const emitter:EmitterInstance={id:input.id,platformId:input.platformId,definitionId:input.definition.id,position:input.position.clone(),active:false,mode:"search",emissionStrength:0,lastActivatedAt:time,lastDeactivatedAt:time,health:1,decoy:input.decoy??false,band:input.definition.band};
    this.emitters.set(emitter.id,emitter); return emitter;
  }
  setActive(id:string, active:boolean, time:number, mode:EmitterInstance["mode"]="search") {
    const emitter=this.emitters.get(id); if(!emitter) return false;
    if(emitter.active===active) return true;
    emitter.active=active; emitter.mode=mode; emitter.emissionStrength=active?Math.max(.05,emitter.health):0;
    if(active) emitter.lastActivatedAt=time; else emitter.lastDeactivatedAt=time;
    return true;
  }
  update(now:number, positions:ReadonlyMap<string,THREE.Vector3>) {
    for(const emitter of this.emitters.values()) { const p=positions.get(emitter.platformId); if(p) emitter.position.copy(p); if(emitter.health<=0) { emitter.active=false; emitter.emissionStrength=0; } }
  }
  remove(id:string){ return this.emitters.delete(id); }
  clear(){ this.emitters.clear(); }
}
