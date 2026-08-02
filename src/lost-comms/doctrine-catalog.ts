import type { LostCommsDoctrineId } from "./types.js";

export interface LostCommsDoctrine {
  id: LostCommsDoctrineId;
  label: string;
  enterBelowQuality: number;
  enterDelay: number;
  restoreAboveQuality: number;
  restoreDelay: number;
  autonomyLevel: number;
  behavior: "hold-command" | "local-defense" | "maintain-orbit" | "last-vector-search" | "continue-strike" | "hold-area" | "preplanned-raid" | "protect-axis" | "organic-surface";
}

const doctrine = (value: LostCommsDoctrine) => value;
export const LOST_COMMS_DOCTRINES: Readonly<Record<LostCommsDoctrineId, LostCommsDoctrine>> = {
  "us-ntu-command": doctrine({ id:"us-ntu-command",label:"NTU command holdover",enterBelowQuality:.22,enterDelay:8,restoreAboveQuality:.55,restoreDelay:12,autonomyLevel:.62,behavior:"hold-command" }),
  "us-ntu-picket": doctrine({ id:"us-ntu-picket",label:"Organic picket defense",enterBelowQuality:.25,enterDelay:5,restoreAboveQuality:.5,restoreDelay:8,autonomyLevel:.9,behavior:"local-defense" }),
  "us-aew-orbit": doctrine({ id:"us-aew-orbit",label:"AEW orbit and retry",enterBelowQuality:.2,enterDelay:8,restoreAboveQuality:.55,restoreDelay:10,autonomyLevel:.7,behavior:"maintain-orbit" }),
  "us-cap-last-vector": doctrine({ id:"us-cap-last-vector",label:"Last vector then sector search",enterBelowQuality:.2,enterDelay:5,restoreAboveQuality:.55,restoreDelay:8,autonomyLevel:.82,behavior:"last-vector-search" }),
  "us-strike-autonomous": doctrine({ id:"us-strike-autonomous",label:"Autonomous strike authorization",enterBelowQuality:.18,enterDelay:7,restoreAboveQuality:.52,restoreDelay:9,autonomyLevel:.78,behavior:"continue-strike" }),
  "soviet-aew-hold": doctrine({ id:"soviet-aew-hold",label:"AEW hold and voice retry",enterBelowQuality:.24,enterDelay:7,restoreAboveQuality:.58,restoreDelay:12,autonomyLevel:.45,behavior:"hold-area" }),
  "soviet-raid-preplanned": doctrine({ id:"soviet-raid-preplanned",label:"Preplanned maritime raid",enterBelowQuality:.28,enterDelay:4,restoreAboveQuality:.58,restoreDelay:10,autonomyLevel:.86,behavior:"preplanned-raid" }),
  "soviet-escort-axis": doctrine({ id:"soviet-escort-axis",label:"Protect last known raid axis",enterBelowQuality:.24,enterDelay:5,restoreAboveQuality:.55,restoreDelay:9,autonomyLevel:.75,behavior:"protect-axis" }),
  "soviet-surface-autonomous": doctrine({ id:"soviet-surface-autonomous",label:"Organic surface action",enterBelowQuality:.2,enterDelay:8,restoreAboveQuality:.5,restoreDelay:12,autonomyLevel:.72,behavior:"organic-surface" }),
};
