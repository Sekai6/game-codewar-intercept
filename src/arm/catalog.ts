import type { ArmWeaponProfile, EmitterDefinition } from "./types.js";
export const ARM_WEAPONS: Readonly<Record<"AGM-45A"|"AGM-88A", ArmWeaponProfile>> = {
  "AGM-45A": { id:"AGM-45A", seekerBands:["S","C","X"], seekerRange:120, seekerFovDeg:70, memoryDuration:8, reacquisitionWindow:0, homeOnJam:false, shutdownBehavior:"memory-only", seekerUpdateInterval:.25 },
  "AGM-88A": { id:"AGM-88A", seekerBands:["S","C","X","Ku"], seekerRange:180, seekerFovDeg:90, memoryDuration:24, reacquisitionWindow:18, homeOnJam:true, shutdownBehavior:"memory-and-reacquire", seekerUpdateInterval:.2 },
};
export const ARM_EMITTERS: Readonly<Record<string, EmitterDefinition>> = {
  "AN-SPY-1-search": { id:"AN-SPY-1-search", name:"AN/SPY-1 Search Radar", emitterType:"search-radar", band:"S", nominalPower:1, detectionSignature:1, frequencyAgility:.7, shutdownDelay:2, restartDelay:8 },
  "AN-SPG-49-fire-control": { id:"AN-SPG-49-fire-control", name:"AN/SPG-49 Fire Control", emitterType:"fire-control-radar", band:"X", nominalPower:.8, detectionSignature:1.2, frequencyAgility:.35, shutdownDelay:1, restartDelay:6 },
  "Liana-search": { id:"Liana-search", name:"Liana Search Radar", emitterType:"search-radar", band:"UHF", nominalPower:.9, detectionSignature:1, frequencyAgility:.2, shutdownDelay:2, restartDelay:10 },
};
