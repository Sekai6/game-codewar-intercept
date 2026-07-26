import * as THREE from "three";
import type { TacticalNetworkObservation, TacticalNetworkNodeView } from "../datalink/observability.js";
import type { SovietC2Observation, SovietC2NodeView } from "../soviet-c2/observability.js";
import type { FleetObservation } from "../fleet/observability.js";
import { fleetVisualCommands } from "../fleet/visuals.js";

export interface TacticalNetworkRuntime {
  readonly visible:boolean;
  update(time:number):void;
  writeDiagnostics(canvas:HTMLCanvasElement):void;
  dispose():void;
}
interface Options {scene:THREE.Scene;parent:HTMLElement;observation:()=>TacticalNetworkObservation;sovietObservation?:()=>SovietC2Observation;fleetObservation?:()=>FleetObservation|undefined;}
type ViewMode="off"|"all"|"link11"|"link16"|"soviet";
const COLORS={link11:0xe4aa54,link16:0x42d7e8,soviet:0xe85f4c,sovietArea:0xffa34f,gci:0xd85cff},clamp=THREE.MathUtils.clamp;

export function createTacticalNetworkRuntime(options:Options):TacticalNetworkRuntime {
  const group=new THREE.Group();group.name="tactical-network-observer";group.renderOrder=900;options.scene.add(group);
  const panel=document.createElement("aside");panel.className="network-observer";
  panel.innerHTML='<header><b>TACTICAL NETWORK</b><span>N TOGGLE / SHIFT+N FILTER</span></header><div class="network-summary"></div><div class="network-events"></div>';
  options.parent.append(panel);
  let mode:ViewMode="off",lastMode:Exclude<ViewMode,"off">="all",lastBuild=-Infinity,lastObservation=options.observation(),lastSovietObservation=options.sovietObservation?.(),lastFleetObservation=options.fleetObservation?.();

  function material(color:number,opacity:number){return new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false});}
  function clearGroup(){for(const child of [...group.children]){group.remove(child);child.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const m=object.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose();}});}}
  function line(a:THREE.Vector3,b:THREE.Vector3,color:number,opacity:number){const object=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().add(new THREE.Vector3(0,5,0)),b.clone().add(new THREE.Vector3(0,5,0))]),material(color,opacity));object.renderOrder=901;group.add(object);}
  function nodeMarker(node:TacticalNetworkNodeView){const radius=node.role==="ncs"?2.3:1.5;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshBasicMaterial({color:COLORS[node.network],transparent:true,opacity:.88,depthTest:false}));mesh.position.copy(node.position).add(new THREE.Vector3(0,5,0));mesh.renderOrder=903;group.add(mesh);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.5,radius*1.72,24),new THREE.MeshBasicMaterial({color:COLORS[node.network],transparent:true,opacity:node.role==="ncs"?.85:.4,side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(mesh.position);ring.renderOrder=902;group.add(ring);}
  function uncertaintyTrack(track:TacticalNetworkObservation["tracks"][number]){const radius=clamp(Math.sqrt(Math.max(1,track.uncertainty))*.38,3,42);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.88,radius,36),new THREE.MeshBasicMaterial({color:COLORS[track.network],transparent:true,opacity:clamp(track.quality*.55,.12,.46),side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(track.position);ring.renderOrder=901;group.add(ring);
    const ageSpread=track.network==="link11"?track.age*.4:track.age*.18;ring.scale.set(1+ageSpread,1,clamp(.72+track.quality*.35,.72,1.05));}
  function sovietNodeMarker(node:SovietC2NodeView){const radius=node.kind==="fleet-command"?2.4:2;
    const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(radius),new THREE.MeshBasicMaterial({color:node.kind==="gci-controller"?COLORS.gci:COLORS.soviet,transparent:true,opacity:node.operational?.9:.25,depthTest:false}));mesh.position.copy(node.position).add(new THREE.Vector3(0,6,0));mesh.renderOrder=903;group.add(mesh);}
  function sovietArea(area:SovietC2Observation["maritimeAreas"][number]){const ring=new THREE.Mesh(new THREE.RingGeometry(.92,1,48),new THREE.MeshBasicMaterial({color:COLORS.sovietArea,transparent:true,opacity:clamp(area.quality*.62,.18,.48),side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.rotation.z=-area.uncertaintyBearing;ring.scale.set(area.uncertaintyMajor,area.uncertaintyMinor,1);ring.position.copy(area.estimatedPosition).add(new THREE.Vector3(0,.35,0));ring.renderOrder=901;group.add(ring);line(area.launchRegionCenter,area.estimatedPosition,COLORS.sovietArea,.28);}
  function fleetChain(fleet:FleetObservation){
    for(const command of fleetVisualCommands(fleet)){
      if(command.kind==="member"){
        const marker=new THREE.Mesh(new THREE.RingGeometry(2.1,2.45,20),new THREE.MeshBasicMaterial({color:command.color,transparent:true,opacity:.72,side:THREE.DoubleSide,depthTest:false}));
        marker.rotation.x=-Math.PI/2;marker.position.set(command.x,command.y+.7,command.z);marker.renderOrder=904;group.add(marker);
      } else if(command.kind==="formation-line"||command.kind==="task-line"){
        line(new THREE.Vector3(...command.from),new THREE.Vector3(...command.to),command.color,command.kind==="task-line"?.55:.24);
      } else if(command.kind==="station-error"){
        const ring=new THREE.Mesh(new THREE.RingGeometry(command.radius*.82,command.radius,20),new THREE.MeshBasicMaterial({color:command.color,transparent:true,opacity:.34,side:THREE.DoubleSide,depthTest:false}));
        ring.rotation.x=-Math.PI/2;ring.position.set(command.x,command.y+.8,command.z);ring.renderOrder=903;group.add(ring);
      } else {
        const arrow=new THREE.Mesh(new THREE.ConeGeometry(1.1,3.2,8),new THREE.MeshBasicMaterial({color:command.color,depthTest:false}));
        arrow.position.set(...command.at);arrow.lookAt(new THREE.Vector3(...command.to));arrow.rotateX(Math.PI/2);arrow.renderOrder=905;group.add(arrow);
      }
    }
  }
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
    for(const track of observation.tracks.filter(track=>accepts(track.network)))uncertaintyTrack(track);
    if(lastFleetObservation&&mode==="all")fleetChain(lastFleetObservation);
    const soviet=lastSovietObservation,showSoviet=mode==="all"||mode==="soviet";
    if(soviet&&showSoviet){for(const node of soviet.nodes)sovietNodeMarker(node);for(const area of soviet.maritimeAreas)sovietArea(area);
      for(const command of soviet.gciCommands){line(command.participantPosition,command.interceptPoint,COLORS.gci,clamp(command.quality,.25,.75));const marker=new THREE.Mesh(new THREE.RingGeometry(2.6,3.2,24),new THREE.MeshBasicMaterial({color:COLORS.gci,transparent:true,opacity:.7,side:THREE.DoubleSide,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(command.interceptPoint);marker.renderOrder=902;group.add(marker);}
      const nodeById=new Map(soviet.nodes.map(node=>[node.id,node]));for(const order of soviet.fleetOrders){const node=nodeById.get(order.commandNodeId);if(node)line(node.position,order.participantPosition,COLORS.soviet,.46);line(order.participantPosition,order.approachPoint,COLORS.soviet,.32);}
      for(const assignment of soviet.salvoAssignments){const armed=time>=assignment.releaseAt;const marker=new THREE.Mesh(new THREE.RingGeometry(2.1,2.8,20),new THREE.MeshBasicMaterial({color:armed?0xffdf6e:COLORS.soviet,transparent:true,opacity:.82,side:THREE.DoubleSide,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(assignment.participantPosition).add(new THREE.Vector3(0,1,0));marker.renderOrder=904;group.add(marker);}}
    group.visible=mode!=="off";}
  function updatePanel(){const o=lastObservation,summary=panel.querySelector(".network-summary")!,events=panel.querySelector(".network-events")!;
    const sovietMode=mode==="soviet",online=sovietMode?(lastSovietObservation?.enabled??false):o.enabled,era=sovietMode?(lastSovietObservation?.era??"none"):o.era;
    summary.innerHTML=`<div><strong>${era.toUpperCase()} / ${mode.toUpperCase()}</strong><i class="${online?"on":"off"}">${online?"ONLINE":"DISCONNECTED"}</i></div>`+
      `<p><b>LINK 11</b> NCS ${o.link11.netControlStation??"--"} / CYCLE ${o.link11.cycleSeconds.toFixed(1)}s / DELAY ${o.link11.meanDelay.toFixed(2)}s</p>`+
      `<p><b>LINK 16</b> TX ${o.link16.transmitted} / RX ${o.link16.delivered} / DELAY ${o.link16.meanDelay.toFixed(2)}s</p>`+
      `<p><b>SOVIET C2</b> ${lastSovietObservation?.era.toUpperCase()??"--"} / GCI ${lastSovietObservation?.gciCommands.length??0} / AREA ${lastSovietObservation?.maritimeAreas.length??0} / ORDER ${lastSovietObservation?.fleetOrders.length??0} / SALVO ${lastSovietObservation?.salvoAssignments.length??0}</p>`+
      `<p><b>TRACKS</b> ${o.tracks.length} REMOTE / <em>CUE ONLY - NO WEAPON AUTHORITY</em></p>`+
      (lastFleetObservation?`<p><b>FLEET CHAIN</b> ${lastFleetObservation.members.length} SHIPS / ${lastFleetObservation.assignments.length} TASKS / ${lastFleetObservation.assignments.filter(task=>task.weaponsAway>0).length} FIRING / <em>ORGANIC TRACK REQUIRED</em></p>`:"");
    events.innerHTML=sovietMode
      ? (lastSovietObservation?.events.slice(-6).reverse().map(event=>`<p><time>${event.time.toFixed(1)}</time><b>SOVIET ${event.layer.toUpperCase()}</b> ${event.text}</p>`).join("")||"<p>NO SOVIET C2 TRAFFIC</p>")
      : (o.activities.slice(-6).reverse().map(event=>`<p><time>${event.time.toFixed(1)}</time><b>${event.network.toUpperCase()}</b> ${event.kind.toUpperCase()} ${event.senderId}${event.recipientId?` -> ${event.recipientId}`:""}${event.trackId?` / ${event.trackId}`:""}</p>`).join("")||"<p>NO NETWORK TRAFFIC</p>")+
        (lastFleetObservation?.assignments.slice(0,4).map(task=>`<p class="fleet-task"><time>${task.weaponsAway}</time><b>${task.shooterId}</b> ${task.weapon} / ${task.targetId} / ${task.status.toUpperCase()}</p>`).join("")||"");}
  function applyMode(next:ViewMode){mode=next;if(next!=="off")lastMode=next;group.visible=next!=="off";panel.classList.toggle("visible",next!=="off");lastBuild=-Infinity;}
  const onKey=(event:KeyboardEvent)=>{if(event.key.toLowerCase()!=="n"||event.repeat)return;if(event.shiftKey){const modes:ViewMode[]=["link11","link16","soviet","all","off"];applyMode(modes[(modes.indexOf(mode)+1)%modes.length]);}else applyMode(mode==="off"?lastMode:"off");};
  addEventListener("keydown",onKey);
  return {get visible(){return mode!=="off";},update(time){lastObservation=options.observation();lastSovietObservation=options.sovietObservation?.();lastFleetObservation=options.fleetObservation?.();if(time-lastBuild>=.12){lastBuild=time;rebuild(time);updatePanel();}},
    writeDiagnostics(canvas){canvas.dataset.networkObserver=String(mode!=="off");canvas.dataset.networkObserverMode=mode;canvas.dataset.networkObserverNodes=String(lastObservation.nodes.length);canvas.dataset.networkObserverTracks=String(lastObservation.tracks.length);canvas.dataset.networkObserverActivities=String(lastObservation.activities.length);canvas.dataset.networkObserverSovietNodes=String(lastSovietObservation?.nodes.length??0);canvas.dataset.networkObserverSovietCommands=String(lastSovietObservation?.gciCommands.length??0);canvas.dataset.networkObserverSovietAreas=String(lastSovietObservation?.maritimeAreas.length??0);canvas.dataset.networkObserverSovietOrders=String(lastSovietObservation?.fleetOrders.length??0);canvas.dataset.networkObserverSovietSalvos=String(lastSovietObservation?.salvoAssignments.length??0);canvas.dataset.networkObserverFleetShips=String(lastFleetObservation?.members.length??0);canvas.dataset.networkObserverFleetAssignments=String(lastFleetObservation?.assignments.length??0);canvas.dataset.networkObserverFleetWeaponsAway=String(lastFleetObservation?.assignments.reduce((sum,task)=>sum+task.weaponsAway,0)??0);canvas.dataset.networkObserverObjects=String(group.children.length);},
    dispose(){removeEventListener("keydown",onKey);clearGroup();options.scene.remove(group);panel.remove();}};
}
