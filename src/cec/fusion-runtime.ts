import * as THREE from "three";
import type { CecCompositeTrack, CecMeasurement, CecEngagementQuality } from "./types.js";
import { covarianceFuse, covarianceInflate, covarianceQuality, covarianceTrace } from "./covariance.js";

export interface FusionOptions { gateDistance?:number; maxAge?:number; weaponTraceLimit?:number; }
export interface FusionConflict { targetId:string; accepted:string[]; rejected:string[]; residual:number; time:number; }
export class CecFusionRuntime {
  readonly tracks=new Map<string,CecCompositeTrack>(); readonly conflicts:FusionConflict[]=[];
  constructor(private readonly options:FusionOptions={}) {}
  ingest(measurements:readonly CecMeasurement[], now:number):CecCompositeTrack[] {
    const grouped=new Map<string,CecMeasurement[]>(); for(const m of measurements){if(now-m.observedAt<0 || now-m.observedAt>(this.options.maxAge??15))continue; const a=grouped.get(m.targetId)??[];a.push(m);grouped.set(m.targetId,a);}
    for(const [targetId,ms] of grouped){ ms.sort((a,b)=>b.quality-a.quality); const anchor=ms[0]; const accepted:string[]=[anchor.id], rejected:string[]=[]; let pos=anchor.position.clone(), vel=anchor.velocity.clone(), cov=anchor.covariance, total=Math.max(.01,anchor.quality);
      for(const m of ms.slice(1)){const d=pos.distanceTo(m.position); if(d>(this.options.gateDistance??180)){rejected.push(m.id);continue;} const w=Math.max(.01,m.quality*m.timeSyncQuality); pos.lerp(m.position,w/(total+w)); vel.lerp(m.velocity,w/(total+w)); cov=covarianceFuse(cov,m.covariance,total,w);total+=w;accepted.push(m.id);}
      if(rejected.length)this.conflicts.push({targetId,accepted,rejected,residual:anchor.position.distanceTo(ms.find(m=>m.id===rejected[0])!.position),time:now});
      const q=Math.min(1,total/Math.max(1,ms.length)); const age=Math.max(0,now-anchor.observedAt); const trace=covarianceTrace(cov); const quality: CecEngagementQuality =  trace <= (this.options.weaponTraceLimit??9000) && accepted.length>=1 ? "weapon" : accepted.length>1 ? "composite" : "cue";
      this.tracks.set(targetId,{id:`CEC-${targetId}`,targetId,contributors:[...new Set(ms.filter(m=>accepted.includes(m.id)).map(m=>m.sourcePlatformId))],position:pos,velocity:vel,altitude:pos.y,covariance:cov,quality:q,lastMeasurementAt:anchor.observedAt,fusionAge:age,engagementQuality:quality,weaponSupport:{allowed:quality==="weapon",supportingPlatforms:[...new Set(ms.filter(m=>accepted.includes(m.id)).map(m=>m.sourcePlatformId))],requiredLocalChecks:["local-fire-control","weapon-channel","launcher-available"],rejectionReason:quality==="weapon"?undefined:"local confirmation or covariance required"}});
    }
    return [...this.tracks.values()];
  }
  tick(now:number){for(const [id,t] of this.tracks){t.fusionAge=Math.max(0,now-t.lastMeasurementAt);if(t.fusionAge>(this.options.maxAge??15)){t.engagementQuality="cue";t.weaponSupport.allowed=false;t.weaponSupport.rejectionReason="TRACK_EXPIRED";} else if(t.fusionAge>4){t.engagementQuality="cue";t.weaponSupport.allowed=false; t.covariance=covarianceInflate(t.covariance,1.15);}}}
}
