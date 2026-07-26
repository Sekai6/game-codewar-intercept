import type { FleetDoctrine } from "./types.js";

export const FLEET_DOCTRINES: Readonly<Record<string, FleetDoctrine>> = {
  "us-ntu-link11": {
    id: "us-ntu-link11",
    label: "US NTU / LINK 11",
    networkTracksProvideWeaponAuthority: false,
    requireLocalFireControlTrack: true,
    commandReassessmentSeconds: 5,
    reserveFraction: 0.25,
  },
  "us-link16": {
    id: "us-link16",
    label: "US LINK 16 MODERNIZED",
    networkTracksProvideWeaponAuthority: false,
    requireLocalFireControlTrack: true,
    commandReassessmentSeconds: 1,
    reserveFraction: 0.2,
  },
};

