import * as THREE from "three";
import type { AirPlatformId, AirTrack } from "../types.js";
import type { CombatSide } from "../../combat-entity.js";

export interface AewCommandNode {
  id:string; side:CombatSide; position:THREE.Vector3; velocity:THREE.Vector3;
  alive:boolean; mode:"link4a"|"voice-gci"; controllerCapacity:number;
  commandDelay:number; commandLife:number; reliability:number;
  fighterPlatformIds:readonly AirPlatformId[]; tracks:readonly AirTrack[];
}
export interface AewCommandParticipant {id:string;side:CombatSide;platformId:AirPlatformId;position:THREE.Vector3;alive:boolean;}
export interface AewInterceptCommand {
  id:string;controllerId:string;controllerTrackId:string;participantId:string;
  mode:"link4a"|"voice-gci";interceptPoint:THREE.Vector3;commandedAltitude:number;
  commandedSpeed:number;radarActivationRange:number;quality:number;uncertainty:number;
  deliveredAt:number;expiresAt:number;
}
type Pending={command:AewInterceptCommand;deliverAt:number};

function hash(value:string){let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function trackNumber(nodeId:string,track:AirTrack){return `AEW-${hash(`${nodeId}:${track.observationId??track.targetId}:${track.lastUpdate.toFixed(1)}`).toString(16).padStart(8,"0")}`;}

export class AewCommandNetwork {
  private readonly commands=new Map<string,AewInterceptCommand>();
  private readonly pending:Pending[]=[];
  private serial=0;
  reset(){this.commands.clear();this.pending.length=0;this.serial=0;}
  update(time:number,nodes:readonly AewCommandNode[],participants:readonly AewCommandParticipant[]){
    for(const [id,command] of this.commands)if(command.expiresAt<=time||!participants.some(p=>p.id===id&&p.alive))this.commands.delete(id);
    for(let index=this.pending.length-1;index>=0;index--){const item=this.pending[index];if(item.deliverAt>time)continue;this.pending.splice(index,1);this.commands.set(item.command.participantId,item.command);}
    for(const node of nodes.filter(n=>n.alive)){
      const occupied=[...this.commands.values()].filter(command=>command.controllerId===node.id).length+
        this.pending.filter(item=>item.command.controllerId===node.id).length;
      const available=Math.max(0,node.controllerCapacity-occupied);
      const candidates=participants.filter(p=>p.alive&&p.side===node.side&&node.fighterPlatformIds.includes(p.platformId)&&!this.commands.has(p.id)&&!this.pending.some(x=>x.command.participantId===p.id)).slice(0,available);
      const tracks=node.tracks.filter(track=>track.classification==="aircraft"&&track.quality>=.16).sort((a,b)=>b.quality-a.quality);
      for(let index=0;index<Math.min(candidates.length,tracks.length);index++){
        const participant=candidates[index],track=tracks[index],age=Math.max(0,time-track.lastUpdate);
        const estimate=track.position.clone().addScaledVector(track.velocity,age+node.commandDelay);
        const quality=THREE.MathUtils.clamp(track.quality*node.reliability-(node.mode==="voice-gci"?.13:.04),.08,.88);
        const command:AewInterceptCommand={id:`AEW-CMD-${++this.serial}`,controllerId:node.id,controllerTrackId:trackNumber(node.id,track),participantId:participant.id,mode:node.mode,interceptPoint:estimate,commandedAltitude:Math.max(16,estimate.y),commandedSpeed:node.mode==="link4a"?8.6:7.8,radarActivationRange:node.mode==="link4a"?240:340,quality,uncertainty:track.uncertainty+(node.mode==="voice-gci"?32:10),deliveredAt:time+node.commandDelay,expiresAt:time+node.commandDelay+node.commandLife};
        this.pending.push({command,deliverAt:command.deliveredAt});
      }
    }
  }
  commandFor(id:string,time:number){const command=this.commands.get(id);return command&&command.expiresAt>time?command:undefined;}
  active(time:number){return [...this.commands.values()].filter(command=>command.expiresAt>time);}
}
