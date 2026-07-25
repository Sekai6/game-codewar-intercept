export type SovietCommandEra =
  | "early-cold-war"
  | "ocean-navy"
  | "ntu-1980s"
  | "late-soviet";

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
}

export const SOVIET_COMMAND_ERAS: Readonly<Record<SovietCommandEra, SovietCommandEraDefinition>> = {
  "early-cold-war": {
    id: "early-cold-war", label: "EARLY COLD WAR",
    description: "Voice/GCI control; no ocean reconnaissance satellite layer",
    gciAvailable: true, uspekhAvailable: false, legendaAvailable: false,
    fleetCommandAvailable: false, automaticGci: false, rank: 0,
  },
  "ocean-navy": {
    id: "ocean-navy", label: "1970s OCEAN NAVY",
    description: "Automated GCI and Uspekh-U targeting",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: false,
    fleetCommandAvailable: true, automaticGci: true, rank: 1,
  },
  "ntu-1980s": {
    id: "ntu-1980s", label: "1980s NTU OPPOSITION",
    description: "Automated GCI, Uspekh-U and intermittent Legenda reports",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: true,
    fleetCommandAvailable: true, automaticGci: true, rank: 2,
  },
  "late-soviet": {
    id: "late-soviet", label: "LATE SOVIET",
    description: "Improved automated command links; not a Link 16 equivalent",
    gciAvailable: true, uspekhAvailable: true, legendaAvailable: true,
    fleetCommandAvailable: true, automaticGci: true, rank: 3,
  },
};

export function sovietGciOperational(input: { era: SovietCommandEra; enabled: boolean }) {
  return input.enabled && SOVIET_COMMAND_ERAS[input.era].gciAvailable;
}
