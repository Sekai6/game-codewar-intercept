export type DatalinkEra =
  | "ntu-baseline"
  | "jtids-transition"
  | "link16-modernized"
  | "cec-enabled";

export interface DatalinkEraDefinition {
  id: DatalinkEra;
  label: string;
  description: string;
  link11Available: boolean;
  link16Available: boolean;
  shipLink11: boolean;
  aircraftLink16: boolean;
  shipLink16: boolean;
  cecAvailable: boolean;
  selectable: boolean;
  rank: number;
}

export const DATALINK_ERAS: Readonly<Record<DatalinkEra, DatalinkEraDefinition>> = {
  "ntu-baseline": {
    id: "ntu-baseline", label: "NTU BASELINE",
    description: "NTU period / US ship Link 11 (TADIL-A), no Link 16",
    link11Available: true, link16Available: false, shipLink11: true,
    aircraftLink16: false, shipLink16: false,
    cecAvailable: false, selectable: true, rank: 0,
  },
  "jtids-transition": {
    id: "jtids-transition", label: "JTIDS TRANSITION",
    description: "US ship Link 11 plus selected airborne JTIDS terminals",
    link11Available: true, link16Available: true, shipLink11: true,
    aircraftLink16: true, shipLink16: false,
    cecAvailable: false, selectable: true, rank: 1,
  },
  "link16-modernized": {
    id: "link16-modernized", label: "LINK 16 MODERNIZED",
    description: "Game-scaled US ship-air Link 16 network",
    link11Available: false, link16Available: true, shipLink11: false,
    aircraftLink16: true, shipLink16: true,
    cecAvailable: false, selectable: true, rank: 2,
  },
  "cec-enabled": {
    id: "cec-enabled", label: "CEC ENABLED / FUTURE",
    description: "Measurement-level Cooperative Engagement Capability for Long Beach, CG-57 and E-2C",
    link11Available: false, link16Available: true, shipLink11: false,
    aircraftLink16: true, shipLink16: true,
    cecAvailable: true, selectable: true, rank: 3,
  },
};

export function link16Operational(input: { era: DatalinkEra; enabled: boolean }) {
  const definition = DATALINK_ERAS[input.era];
  return definition.selectable && definition.link16Available && input.enabled;
}

export function link11Operational(input: { era: DatalinkEra; enabled: boolean }) {
  const definition = DATALINK_ERAS[input.era];
  return definition.selectable && definition.link11Available && input.enabled;
}

export function shipLink11Eligible(input: { era: DatalinkEra; enabled: boolean }) {
  const definition = DATALINK_ERAS[input.era];
  return link11Operational(input) && definition.shipLink11;
}

export function aircraftLink16Eligible(input: {
  era: DatalinkEra;
  enabled: boolean;
  minimumEra: "jtids-transition" | "link16-modernized";
}) {
  const era = DATALINK_ERAS[input.era];
  return link16Operational(input) && era.aircraftLink16 &&
    era.rank >= DATALINK_ERAS[input.minimumEra].rank;
}

export function shipLink16Eligible(input: { era: DatalinkEra; enabled: boolean }) {
  const era = DATALINK_ERAS[input.era];
  return link16Operational(input) && era.shipLink16;
}
