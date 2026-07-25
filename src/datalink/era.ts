export type DatalinkEra =
  | "ntu-baseline"
  | "jtids-transition"
  | "link16-modernized"
  | "cec-enabled";

export interface DatalinkEraDefinition {
  id: DatalinkEra;
  label: string;
  description: string;
  link16Available: boolean;
  aircraftLink16: boolean;
  shipLink16: boolean;
  cecAvailable: boolean;
  selectable: boolean;
  rank: number;
}

export const DATALINK_ERAS: Readonly<Record<DatalinkEra, DatalinkEraDefinition>> = {
  "ntu-baseline": {
    id: "ntu-baseline", label: "NTU BASELINE",
    description: "Period baseline / local sensors and legacy links only",
    link16Available: false, aircraftLink16: false, shipLink16: false,
    cecAvailable: false, selectable: true, rank: 0,
  },
  "jtids-transition": {
    id: "jtids-transition", label: "JTIDS TRANSITION",
    description: "Selected US airborne JTIDS terminals / no ship Link 16",
    link16Available: true, aircraftLink16: true, shipLink16: false,
    cecAvailable: false, selectable: true, rank: 1,
  },
  "link16-modernized": {
    id: "link16-modernized", label: "LINK 16 MODERNIZED",
    description: "Game-scaled US ship-air Link 16 network",
    link16Available: true, aircraftLink16: true, shipLink16: true,
    cecAvailable: false, selectable: true, rank: 2,
  },
  "cec-enabled": {
    id: "cec-enabled", label: "CEC ENABLED / FUTURE",
    description: "Measurement-level cooperative engagement is not implemented",
    link16Available: true, aircraftLink16: true, shipLink16: true,
    cecAvailable: false, selectable: false, rank: 3,
  },
};

export function link16Operational(input: { era: DatalinkEra; enabled: boolean }) {
  const definition = DATALINK_ERAS[input.era];
  return definition.selectable && definition.link16Available && input.enabled;
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
