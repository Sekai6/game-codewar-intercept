import * as THREE from "three";
import type {
  Link11Diagnostics,
  Link16Delivery,
  Link16ParticipantState,
  Link16TrackReport,
  TacticalNetworkActivity,
} from "./types.js";
import { evaluatePropagation } from "../space-weather/propagation-effects.js";
import type { PropagationSpatialZone, SpaceWeatherSnapshot } from "../space-weather/types.js";

export interface Link11ParticipantState extends Link16ParticipantState {
  netControlCapable: boolean;
  radioSilent?: boolean;
}

type Queued = { report: Link16TrackReport; queuedAt: number };
type Pending = Link16Delivery & { deliverAt: number };

function hash01(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

/** Game-scaled Link 11/TADIL-A roll-call net: one NCS polls one participant at a time. */
export class Link11Network {
  private readonly participants = new Map<string, Link11ParticipantState>();
  private readonly queues = new Map<string, Queued[]>();
  private readonly pending: Pending[] = [];
  private readonly inboxes = new Map<string, Link16Delivery[]>();
  private readonly seen = new Map<string, number>();
  private readonly activities: TacticalNetworkActivity[] = [];
  private nextRollCallAt = 0;
  private pollIndex = 0;
  private serial = 0;
  private activitySerial = 0;
  private delayTotal = 0;
  private propagationSnapshot: SpaceWeatherSnapshot | null = null;
  private propagationZones: readonly PropagationSpatialZone[] = [];
  private readonly pollSeconds = 2;
  private readonly maximumRange = 1200;
  private diagnosticsState: Link11Diagnostics = this.emptyDiagnostics();

  private emptyDiagnostics(): Link11Diagnostics {
    return { queued:0, transmitted:0, delivered:0, droppedCapacity:0,
      droppedLink:0, droppedDuplicate:0, meanDelay:0, rollCalls:0,
      netControlStation:null, cycleSeconds:0 };
  }

  reset() {
    this.participants.clear(); this.queues.clear(); this.pending.length = 0;
    this.inboxes.clear(); this.seen.clear(); this.nextRollCallAt = 0;
    this.activities.length = 0;
    this.pollIndex = 0; this.serial = 0; this.activitySerial = 0; this.delayTotal = 0;
    this.diagnosticsState = this.emptyDiagnostics();
  }

  upsertParticipant(state: Link11ParticipantState) {
    this.participants.set(state.id, { ...state, position:state.position.clone(),
      terminalHealth:THREE.MathUtils.clamp(state.terminalHealth,0,1),
      timeSyncQuality:THREE.MathUtils.clamp(state.timeSyncQuality,0,1) });
  }

  setPropagationSnapshot(snapshot: SpaceWeatherSnapshot | null) { this.propagationSnapshot = snapshot; }
  setPropagationZones(zones: readonly PropagationSpatialZone[]) { this.propagationZones = zones.map((zone) => ({ ...zone, center:[...zone.center] as [number,number,number] })); }

  publishTrack(senderId:string,
    input:Omit<Link16TrackReport,"messageId"|"senderId"|"side"|"transmittedAt">,
    time:number) {
    const sender=this.participants.get(senderId);
    if (!sender?.alive || sender.radioSilent || !sender.transmitEnabled || sender.terminalHealth<=.05) return false;
    const queue=this.queues.get(senderId) ?? [];
    if (queue.length>=12) { queue.shift(); this.diagnosticsState.droppedCapacity++; }
    queue.push({ queuedAt:time, report:{ ...input, messageId:`M-series-${++this.serial}`,
      senderId, side:sender.side, transmittedAt:time, position:input.position.clone(),
      velocity:input.velocity.clone(), relayChain:[...input.relayChain,senderId] } });
    this.queues.set(senderId,queue); this.diagnosticsState.queued++; return true;
  }

  update(time:number) {
    while (time>=this.nextRollCallAt) { this.rollCall(this.nextRollCallAt); this.nextRollCallAt+=this.pollSeconds; }
    for (let i=this.pending.length-1;i>=0;i--) {
      const delivery=this.pending[i]; if (delivery.deliverAt>time) continue;
      this.pending.splice(i,1);
      const key=`${delivery.recipientId}:${delivery.report.observationId}`;
      if (this.seen.has(key)) { this.diagnosticsState.droppedDuplicate++; continue; }
      this.seen.set(key,time); const inbox=this.inboxes.get(delivery.recipientId)??[];
      inbox.push(delivery); this.inboxes.set(delivery.recipientId,inbox);
      this.diagnosticsState.delivered++; this.delayTotal+=delivery.networkDelay;
      this.record({kind:"deliver",time,senderId:delivery.report.senderId,
        recipientId:delivery.recipientId,trackId:delivery.report.trackId,delay:delivery.networkDelay});
    }
    for (const [key,at] of this.seen) if(time-at>40)this.seen.delete(key);
    this.diagnosticsState.meanDelay=this.diagnosticsState.delivered?this.delayTotal/this.diagnosticsState.delivered:0;
  }

  private rollCall(time:number) {
    const live=[...this.participants.values()].filter(p=>p.alive&&!p.radioSilent);
    const ncs=live.filter(p=>p.netControlCapable&&p.transmitEnabled).sort((a,b)=>b.terminalHealth-a.terminalHealth||a.id.localeCompare(b.id))[0];
    this.diagnosticsState.netControlStation=ncs?.id??null;
    this.diagnosticsState.cycleSeconds=live.length*this.pollSeconds;
    if(!ncs||!live.length)return;
    const sender=live[this.pollIndex++%live.length]; this.diagnosticsState.rollCalls++;
    this.record({kind:"poll",time,senderId:ncs.id,recipientId:sender.id});
    const queue=this.queues.get(sender.id); const item=queue?.shift(); if(!item)return;
    this.diagnosticsState.transmitted++;
    this.record({kind:"transmit",time,senderId:sender.id,recipientId:ncs.id,trackId:item.report.trackId});
    for(const recipient of live) {
      if(recipient.id===sender.id||recipient.side!==sender.side||!recipient.receiveEnabled||recipient.terminalHealth<=.05)continue;
      const range=sender.position.distanceTo(recipient.position);
      if(range>this.maximumRange){this.diagnosticsState.droppedLink++;this.record({kind:"drop",time,senderId:sender.id,recipientId:recipient.id,trackId:item.report.trackId,reason:"out-of-range"});continue;}
      const rangeFactor=range/this.maximumRange;
      const success=THREE.MathUtils.clamp(.91*sender.terminalHealth*recipient.terminalHealth-rangeFactor*.22,.08,.96);
      const propagation=this.propagationSnapshot?evaluatePropagation(this.propagationSnapshot,{channel:"link11",messageId:item.report.messageId,senderId:sender.id,recipientId:recipient.id,baseQuality:item.report.quality,baseSuccessProbability:success,rangeRatio:rangeFactor,senderPosition:[sender.position.x,sender.position.y,sender.position.z],recipientPosition:[recipient.position.x,recipient.position.y,recipient.position.z],spatialZones:this.propagationZones}):null;
      if(propagation?.dropped||(!propagation&&hash01(`${item.report.messageId}:${recipient.id}`)>success)){this.diagnosticsState.droppedLink++;this.record({kind:"drop",time,senderId:sender.id,recipientId:recipient.id,trackId:item.report.trackId,reason:propagation?.reason==="localized-disturbance"?"localized-disturbance":propagation?.reason==="space-weather-loss"?"space-weather-loss":"link-quality"});continue;}
      const networkDelay=Math.max(0,time-item.report.observedAt)+1.1+rangeFactor*.8+(propagation?.delaySeconds??0);
      const report={...item.report,position:item.report.position.clone(),velocity:item.report.velocity.clone(),
        quality:item.report.quality*.72*(propagation?.qualityMultiplier??1),uncertainty:(item.report.uncertainty+3500+networkDelay*180)*(propagation?.uncertaintyMultiplier??1)};
      const deliveryDelay=1.1+(propagation?.delaySeconds??0);
      this.pending.push({recipientId:recipient.id,report,receivedAt:time+deliveryDelay,
        networkDelay,deliverAt:time+deliveryDelay});
      this.record({kind:"transmit",time,senderId:sender.id,recipientId:recipient.id,
        trackId:item.report.trackId,delay:1.1});
    }
  }

  drainInbox(id:string){const value=this.inboxes.get(id)??[];this.inboxes.delete(id);return value;}
  diagnostics():Readonly<Link11Diagnostics>{return {...this.diagnosticsState};}
  participantStates(){return [...this.participants.values()].map(p=>({...p,position:p.position.clone()}));}
  recentActivities(time:number){return this.activities.filter(event=>time-event.time<=12).map(event=>({...event}));}
  private record(event:Omit<TacticalNetworkActivity,"id"|"network">){
    this.activities.push({...event,id:`L11-A${++this.activitySerial}`,network:"link11"});
    if(this.activities.length>96)this.activities.splice(0,this.activities.length-96);
  }
}
