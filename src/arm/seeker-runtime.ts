import * as THREE from "three";
import type { ArmSeekerState, ArmWeaponProfile, EmitterInstance } from "./types.js";
export function updateArmSeeker(input:{state:ArmSeekerState; profile:ArmWeaponProfile; missilePosition:THREE.Vector3; emitters:readonly EmitterInstance[]; time:number; dt:number; sample?:number}):ArmSeekerState {
  const s=input.state, target=s.targetEmitterId ? input.emitters.find(e=>e.id===s.targetEmitterId) : undefined;
  if (s.mode === "impact" || s.mode === "miss") return s;
  const candidates=input.emitters.filter(e=>e.active && e.health>.1 && input.profile.seekerBands.includes((e as EmitterInstance & {band?:string}).band ?? ""));
  if (target?.active) { s.mode="terminal-home"; s.lastSignalAt=input.time; s.lastKnownPosition=target.position.clone(); return s; }
  if (target && !target.active && s.mode !== "memory-track" && s.mode !== "reacquisition") {
    s.mode="memory-track"; s.memoryExpiresAt=input.time+input.profile.memoryDuration; s.lastKnownPosition=target.position.clone();
  }
  if (s.mode === "memory-track") {
    if ((s.memoryExpiresAt??0) <= input.time) { s.mode=input.profile.reacquisitionWindow>0 ? "reacquisition" : "lost"; s.reacquisitionUntil=input.time+input.profile.reacquisitionWindow; }
    else return s;
  }
  if (s.mode === "reacquisition") {
    const reacquired=candidates.find(e=>e.id===s.targetEmitterId) ?? candidates[0];
    if (reacquired && (input.sample??0)<.75) { s.targetEmitterId=reacquired.id; s.mode="terminal-home"; s.lastKnownPosition=reacquired.position.clone(); s.lastSignalAt=input.time; return s; }
    if ((s.reacquisitionUntil??0)<=input.time) s.mode="lost";
    return s;
  }
  if (!s.targetEmitterId) {
    s.mode="emitter-search";
    const found=candidates.find(e=>e.position.distanceTo(input.missilePosition)<=input.profile.seekerRange);
    if (found) { s.targetEmitterId=found.id; s.mode="emitter-acquired"; s.lastKnownPosition=found.position.clone(); s.lastSignalAt=input.time; }
  }
  return s;
}
