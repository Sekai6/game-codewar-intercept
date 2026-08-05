import * as THREE from "three";
import type { ShipTrackEstimate } from "../ships/types.js";

export type TrackFusionEvent = {
  kind: "conflict-detected" | "conflict-updated" | "conflict-resolved";
  trackId: string;
  separation: number;
  contributors: readonly string[];
  confirmations: number;
};

type ConflictState = {
  confirmations:number;
  lastSeparation:number;
  lastSeen:number;
  contributors:string[];
  lastEventAt:number;
  lastEventSeparation:number;
  lastEventConfirmations:number;
};

const CONFLICT_UPDATE_INTERVAL_SECONDS = 8;
const CONFLICT_HEARTBEAT_SECONDS = 24;
const CONFLICT_SEPARATION_CHANGE_RATIO = .2;
const CONFLICT_SEPARATION_CHANGE_ABSOLUTE = 20;
const RESOLUTION_HYSTERESIS_SECONDS = 15;
const REOPEN_SEPARATION_FACTOR = 1.35;

export class ConflictTrackFusionRuntime {
  private readonly conflicts = new Map<string, ConflictState>();
  private readonly resolvedUntil = new Map<string, number>();
  private readonly events: TrackFusionEvent[] = [];

  fuse(reports: readonly { track:ShipTrackEstimate; contributor:string }[], now:number) {
    const fused = new Map<string, ShipTrackEstimate>();
    const touched = new Set<string>();
    for (const {track:candidate,contributor} of [...reports].sort((a,b)=>b.track.quality-a.track.quality)) {
      const associated = [...fused.entries()].map(([key,current])=>({key,current,separation:current.position.distanceTo(candidate.position),gate:Math.max(15,(current.uncertainty+candidate.uncertainty)/100)}))
        .filter(({current,separation,gate})=>current.classification===candidate.classification&&separation<=gate*2.4)
        .sort((a,b)=>a.separation-b.separation)[0];
      if (!associated) {
        fused.set(candidate.targetId,{...candidate,position:candidate.position.clone(),velocity:candidate.velocity.clone(),weaponQuality:false,contributors:[contributor]});
        continue;
      }
      const {key,current,separation,gate}=associated;
      const conflictKey=key===candidate.targetId ? key : [key,candidate.targetId].sort().join("|");
      const recentlyResolvedUntil=this.resolvedUntil.get(conflictKey)??Number.NEGATIVE_INFINITY;
      const conflicting=separation>gate
        && (now>=recentlyResolvedUntil||separation>gate*REOPEN_SEPARATION_FACTOR);
      if(conflicting){
        touched.add(conflictKey);
        const existing=this.conflicts.get(conflictKey);
        const state=existing??{confirmations:0,lastSeparation:separation,lastSeen:now,contributors:[...(current.contributors??[]),contributor],lastEventAt:now,lastEventSeparation:separation,lastEventConfirmations:0};
        state.confirmations=Math.max(0,state.confirmations-1);state.lastSeparation=separation;state.lastSeen=now;
        state.contributors=[...new Set([...state.contributors,...(current.contributors??[]),contributor])];
        if(!existing)this.events.push({kind:"conflict-detected",trackId:conflictKey,separation,contributors:state.contributors,confirmations:state.confirmations});
        else {
          const elapsedSinceEvent=now-state.lastEventAt;
          const absoluteSeparationChange=Math.abs(separation-state.lastEventSeparation);
          const separationChange=Math.abs(separation-state.lastEventSeparation)/Math.max(1,state.lastEventSeparation);
          const materiallyChanged=separationChange>=CONFLICT_SEPARATION_CHANGE_RATIO
            && absoluteSeparationChange>=CONFLICT_SEPARATION_CHANGE_ABSOLUTE;
          const confirmationChanged=state.confirmations!==state.lastEventConfirmations;
          const shouldReport=elapsedSinceEvent>=CONFLICT_HEARTBEAT_SECONDS
            || (elapsedSinceEvent>=CONFLICT_UPDATE_INTERVAL_SECONDS&&(materiallyChanged||confirmationChanged));
          if(shouldReport){
            this.events.push({kind:"conflict-updated",trackId:conflictKey,separation,contributors:state.contributors,confirmations:state.confirmations});
            state.lastEventAt=now;state.lastEventSeparation=separation;state.lastEventConfirmations=state.confirmations;
          }
        }
        this.conflicts.set(conflictKey,state);
        current.quality=Math.max(.03,current.quality*.88);
        current.uncertainty=Math.max(current.uncertainty,separation*100*.55);
        current.contributors=state.contributors;
        continue;
      }
      const state=this.conflicts.get(conflictKey);
      if(state){
        state.confirmations++;state.lastSeen=now;state.lastSeparation=separation;touched.add(conflictKey);
        if(state.confirmations<3){current.quality=Math.max(.03,current.quality*.94);current.uncertainty=Math.max(current.uncertainty,separation*100);continue;}
        this.events.push({kind:"conflict-resolved",trackId:conflictKey,separation,contributors:state.contributors,confirmations:state.confirmations});
        this.conflicts.delete(conflictKey);
        this.resolvedUntil.set(conflictKey,now+RESOLUTION_HYSTERESIS_SECONDS);
      }
      const total=Math.max(.01,current.quality+candidate.quality),weight=candidate.quality/total;
      current.position.lerp(candidate.position,weight);current.velocity.lerp(candidate.velocity,weight);
      current.quality=THREE.MathUtils.clamp(Math.max(current.quality,candidate.quality)+Math.min(current.quality,candidate.quality)*.12,0,.92);
      current.uncertainty=Math.min(current.uncertainty,candidate.uncertainty)*.92;current.updatedAt=Math.max(current.updatedAt,candidate.updatedAt);current.weaponQuality=false;
      current.contributors=[...new Set([...(current.contributors??[]),contributor])];
    }
    for(const [key,state] of this.conflicts)if(!touched.has(key)&&now-state.lastSeen>12)this.conflicts.delete(key);
    for(const [key,until] of this.resolvedUntil)if(now>=until)this.resolvedUntil.delete(key);
    return fused;
  }
  drainEvents(){return this.events.splice(0);}
  reset(){this.conflicts.clear();this.resolvedUntil.clear();this.events.length=0;}
}
