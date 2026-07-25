import * as THREE from "three";
import type { TacticalNetworkObservation, TacticalNetworkNodeView } from "../datalink/observability.js";

export interface TacticalNetworkRuntime {
  readonly visible:boolean;
  update(time:number):void;
  writeDiagnostics(canvas:HTMLCanvasElement):void;
  dispose():void;
}
interface Options {scene:THREE.Scene;parent:HTMLElement;observation:()=>TacticalNetworkObservation;}
type ViewMode="off"|"all"|"link11"|"link16";
const COLORS={link11:0xe4aa54,link16:0x42d7e8},clamp=THREE.MathUtils.clamp;

export function createTacticalNetworkRuntime(options:Options):TacticalNetworkRuntime {
  const group=new THREE.Group();group.name="tactical-network-observer";group.renderOrder=900;options.scene.add(group);
  const panel=document.createElement("aside");panel.className="network-observer";
  panel.innerHTML='<header><b>TACTICAL NETWORK</b><span>N TOGGLE / SHIFT+N FILTER</span></header><div class="network-summary"></div><div class="network-events"></div>';
  options.parent.append(panel);
  let mode:ViewMode="off",lastMode:Exclude<ViewMode,"off">="all",lastBuild=-Infinity,lastObservation=options.observation();

  function material(color:number,opacity:number){return new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false});}
  function clearGroup(){for(const child of [...group.children]){group.remove(child);child.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const m=object.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose();}});}}
  function line(a:THREE.Vector3,b:THREE.Vector3,color:number,opacity:number){const object=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().add(new THREE.Vector3(0,5,0)),b.clone().add(new THREE.Vector3(0,5,0))]),material(color,opacity));object.renderOrder=901;group.add(object);}
  function nodeMarker(node:TacticalNetworkNodeView){const radius=node.role==="ncs"?2.3:1.5;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshBasicMaterial({color:COLORS[node.network],transparent:true,opacity:.88,depthTest:false}));mesh.position.copy(node.position).add(new THREE.Vector3(0,5,0));mesh.renderOrder=903;group.add(mesh);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.5,radius*1.72,24),new THREE.MeshBasicMaterial({color:COLORS[node.network],transparent:true,opacity:node.role==="ncs"?.85:.4,side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(mesh.position);ring.renderOrder=902;group.add(ring);}
  function uncertaintyTrack(track:TacticalNetworkObservation["tracks"][number]){const radius=clamp(Math.sqrt(Math.max(1,track.uncertainty))*.38,3,42);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.88,radius,36),new THREE.MeshBasicMaterial({color:COLORS[track.network],transparent:true,opacity:clamp(track.quality*.55,.12,.46),side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(track.position);ring.renderOrder=901;group.add(ring);
    const ageSpread=track.network==="link11"?track.age*.4:track.age*.18;ring.scale.set(1+ageSpread,1,clamp(.72+track.quality*.35,.72,1.05));}
  function rebuild(time:number){clearGroup();const observation=lastObservation,accepts=(network:string)=>mode==="all"||mode===network;
    const visibleNodes=observation.nodes.filter(node=>accepts(node.network)),nodes=new Map(visibleNodes.map(node=>[`${node.network}:${node.id}`,node]));
    for(const node of visibleNodes)nodeMarker(node);
    const activities=observation.activities.filter(event=>accepts(event.network));
    for(const event of activities){
      if(event.network==="link11"&&event.kind==="poll"&&time-event.time<2.05&&event.recipientId){const a=nodes.get(`link11:${event.senderId}`),b=nodes.get(`link11:${event.recipientId}`);if(a&&b)line(a.position,b.position,COLORS.link11,.62);}
    }
    const activeTransmissions=activities.filter(event=>event.kind==="transmit"&&event.recipientId&&event.delay!==undefined&&time-event.time>=0&&time-event.time<=event.delay!*1.15)
      .reverse().filter((event,index,all)=>all.findIndex(candidate=>candidate.network===event.network&&candidate.senderId===event.senderId&&candidate.recipientId===event.recipientId)===index).slice(0,12);
    for(const event of activeTransmissions){
      const a=nodes.get(`${event.network}:${event.senderId}`),b=nodes.get(`${event.network}:${event.recipientId}`);if(!a||!b)continue;
      const progress=(time-event.time)/Math.max(.05,event.delay!);line(a.position,b.position,COLORS[event.network],.22);
      const pulse=new THREE.Mesh(new THREE.SphereGeometry(1.15,10,6),new THREE.MeshBasicMaterial({color:COLORS[event.network],depthTest:false}));pulse.position.lerpVectors(a.position,b.position,clamp(progress,0,1)).add(new THREE.Vector3(0,5,0));pulse.renderOrder=904;group.add(pulse);}
    for(const track of observation.tracks.filter(track=>accepts(track.network)))uncertaintyTrack(track);group.visible=mode!=="off";}
  function updatePanel(){const o=lastObservation,summary=panel.querySelector(".network-summary")!,events=panel.querySelector(".network-events")!;
    summary.innerHTML=`<div><strong>${o.era.toUpperCase()} / ${mode.toUpperCase()}</strong><i class="${o.enabled?"on":"off"}">${o.enabled?"ONLINE":"DISCONNECTED"}</i></div>`+
      `<p><b>LINK 11</b> NCS ${o.link11.netControlStation??"--"} / CYCLE ${o.link11.cycleSeconds.toFixed(1)}s / DELAY ${o.link11.meanDelay.toFixed(2)}s</p>`+
      `<p><b>LINK 16</b> TX ${o.link16.transmitted} / RX ${o.link16.delivered} / DELAY ${o.link16.meanDelay.toFixed(2)}s</p>`+
      `<p><b>TRACKS</b> ${o.tracks.length} REMOTE / <em>CUE ONLY - NO WEAPON AUTHORITY</em></p>`;
    events.innerHTML=o.activities.slice(-6).reverse().map(event=>`<p><time>${event.time.toFixed(1)}</time><b>${event.network.toUpperCase()}</b> ${event.kind.toUpperCase()} ${event.senderId}${event.recipientId?` -> ${event.recipientId}`:""}${event.trackId?` / ${event.trackId}`:""}</p>`).join("")||"<p>NO NETWORK TRAFFIC</p>";}
  function applyMode(next:ViewMode){mode=next;if(next!=="off")lastMode=next;group.visible=next!=="off";panel.classList.toggle("visible",next!=="off");lastBuild=-Infinity;}
  const onKey=(event:KeyboardEvent)=>{if(event.key.toLowerCase()!=="n"||event.repeat)return;if(event.shiftKey){const modes:ViewMode[]=["link11","link16","all","off"];applyMode(modes[(modes.indexOf(mode)+1)%modes.length]);}else applyMode(mode==="off"?lastMode:"off");};
  addEventListener("keydown",onKey);
  return {get visible(){return mode!=="off";},update(time){lastObservation=options.observation();if(time-lastBuild>=.12){lastBuild=time;rebuild(time);updatePanel();}},
    writeDiagnostics(canvas){canvas.dataset.networkObserver=String(mode!=="off");canvas.dataset.networkObserverMode=mode;canvas.dataset.networkObserverNodes=String(lastObservation.nodes.length);canvas.dataset.networkObserverTracks=String(lastObservation.tracks.length);canvas.dataset.networkObserverActivities=String(lastObservation.activities.length);canvas.dataset.networkObserverObjects=String(group.children.length);},
    dispose(){removeEventListener("keydown",onKey);clearGroup();options.scene.remove(group);panel.remove();}};
}
