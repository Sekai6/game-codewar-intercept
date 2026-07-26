import type { NavalForceScenario } from "./types.js";

export const NAVAL_FORCE_SCENARIOS: Readonly<Record<string, NavalForceScenario>> = {
  "blue-ntu-screen": {
    id: "blue-ntu-screen",
    label: "US NTU CRUISER SCREEN",
    side: "blue",
    doctrineId: "us-ntu-link11",
    datalinkEra: "ntu-baseline",
    formation: "screen",
    ships: [
      {
        instanceId: "blue-cgn-9",
        definitionId: "long-beach",
        position: [0, 0, 40],
        heading: Math.PI,
        station: [0, 0, 0],
        formationRole: "command",
        commandRoles: ["otc", "aawc"],
      },
      {
        instanceId: "blue-cg-57",
        definitionId: "ticonderoga",
        position: [-180, 0, -80],
        heading: Math.PI,
        station: [-180, 0, -120],
        formationRole: "picket",
        commandRoles: ["asuwc"],
      },
    ],
  },
};

