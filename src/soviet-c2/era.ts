import type { AirPlatformId, AirWeaponId } from "../air/types.js";
export type SovietCommandEra =
  | "early-cold-war"
  | "ocean-navy"
  | "ntu-1980s"
  | "late-soviet";

export interface SovietSeadEraCapability {
  available: boolean;
  platformIds: readonly AirPlatformId[];
  weaponIds: readonly AirWeaponId[];
  gciEmitterCue: boolean;
  cooperativeEmitterReports: boolean;
  memoryTrackSupport: boolean;
  reacquisitionSupport: boolean;
  coordinatedPairAttack: boolean;
}

export interface SovietCommandEraDefinition {
  id: SovietCommandEra;
  label: string;
  description: string;
  gciAvailable: boolean;
  uspekhAvailable: boolean;
  legendaAvailable: boolean;
  fleetCommandAvailable: boolean;
  automaticGci: boolean;
  rank: number;
  sead: SovietSeadEraCapability;
}

const NO_SEAD: SovietSeadEraCapability = {
  available:false, platformIds:[], weaponIds:[], gciEmitterCue:false,
  cooperativeEmitterReports:false, memoryTrackSupport:false,
  reacquisitionSupport:false, coordinatedPairAttack:false,
};
const LATE_SOVIET_SEAD: SovietSeadEraCapability = {
  available:true, platformIds:["MIG-29A-SEAD"], weaponIds:["Kh-31P-C"],
  gciEmitterCue:true, cooperativeEmitterReports:true, memoryTrackSupport:true,
  reacquisitionSupport:true, coordinatedPairAttack:true,
};

export const SOVIET_COMMAND_ERAS: Readonly<Record<SovietCommandEra, SovietCommandEraDefinition>> = {
  "early-cold-war": {
    id: "early-cold-war", label: "EARLY COLD WAR",
    description: "Voice/GCI control; no ocean reconnaissance satellite layer",
    gciAvailable: true, uspekhAvailable: false, legendaAvailable: false,
    fleetCommandAvailable: false, automaticGci: false, rank: 0,
    sead: NO_SEAD,
  },
  "ocean-navy": {
    id: "ocean-navy", label: "1970s OCEAN NAVY",
    description: "Automated GCI and Uspekh-U targeting",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: false,
    fleetCommandAvailable: true, automaticGci: true, rank: 1,
    sead: NO_SEAD,
  },
  "ntu-1980s": {
    id: "ntu-1980s", label: "1980s NTU OPPOSITION",
    description: "Automated GCI, Uspekh-U and intermittent Legenda reports",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: true,
    fleetCommandAvailable: true, automaticGci: true, rank: 2,
    sead: NO_SEAD,
  },
  "late-soviet": {
    id: "late-soviet", label: "LATE SOVIET",
    description: "Improved automated command links; not a Link 16 equivalent",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: true,
    fleetCommandAvailable: true, automaticGci: true, rank: 3,
    sead: LATE_SOVIET_SEAD,
  },
};

export function sovietGciOperational(input: { era: SovietCommandEra; enabled: boolean }) {
  return input.enabled && SOVIET_COMMAND_ERAS[input.era].gciAvailable;
}
export function sovietSeadCapability(era: SovietCommandEra) { return SOVIET_COMMAND_ERAS[era].sead; }
export function sovietPlatformAvailable(era: SovietCommandEra, platformId: AirPlatformId) { return SOVIET_COMMAND_ERAS[era].sead.platformIds.includes(platformId); }
export function sovietWeaponAvailable(era: SovietCommandEra, weaponId: AirWeaponId) { return SOVIET_COMMAND_ERAS[era].sead.weaponIds.includes(weaponId); }
