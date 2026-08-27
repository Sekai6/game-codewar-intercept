import type { CecMeasurement, CecNetworkConfig, CecNetworkMessage, CecNetworkResult, CecParticipant } from "./types.js";
function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/0xffffffff;}
export class CecNetworkRuntime {
  private readonly participants=new Map<string,CecParticipant>(); private readonly queue:CecNetworkMessage[]=[];
  constructor(public readonly config:CecNetworkConfig, private readonly seed=1) {}
  register(p:CecParticipant):boolean { if(!this.config.enabled||!p.cecCapable||p.side!=="blue")return false; const existing=this.participants.get(p.id); if(!existing && this.participants.size>=(this.config.maxParticipants??3))return false; this.participants.set(p.id,p); return true; }
  unregister(id:string){this.participants.delete(id);}
  reset(){this.participants.clear();this.queue.length=0;}
  enqueue(senderId:string, measurement:CecMeasurement, now:number):number { const sender=this.participants.get(senderId); if(!sender)return 0; let n=0; for(const recipient of this.participants.values()){if(recipient.id===senderId||!recipient.receiveEnabled)continue; const d=sender.position.distanceTo(recipient.position); if(d>(this.config.maxRange??2500))continue; const delay=(this.config.baseDelay??.25)*(1+hash(`${this.seed}:${measurement.id}:${recipient.id}:delay`)*.5);this.queue.push({id:`CEC-N-${measurement.id}-${recipient.id}`,senderId,recipientId:recipient.id,measurement,queuedAt:now,deliverAt:now+delay});n++;} return n; }
  deliver(now:number):CecNetworkResult {const delivered:CecNetworkMessage[]=[],dropped:CecNetworkResult["dropped"]=[]; const keep:CecNetworkMessage[]=[]; for(const m of this.queue){if(m.deliverAt>now){keep.push(m);continue;}const recipient=this.participants.get(m.recipientId),sender=this.participants.get(m.senderId);if(!recipient||!sender||!recipient.receiveEnabled){dropped.push({message:m,reason:"link-quality"});continue;}const r=hash(`${this.seed}:${m.id}:drop`);if(r>(this.config.reliability??.96)){dropped.push({message:m,reason:"link-quality"});continue;}if(recipient.timeSyncQuality<.25||sender.timeSyncQuality<.25){dropped.push({message:m,reason:"time-sync"});continue;}delivered.push(m);}this.queue.splice(0,this.queue.length,...keep);return {delivered,dropped};}
  get pending(){return this.queue.length;} get roster(){return [...this.participants.values()];}
}
