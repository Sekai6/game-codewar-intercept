import type { FleetFormation, NavalForceScenario } from "./types.js";

export function validateNavalForceScenario(scenario: NavalForceScenario): void {
  if (!scenario.id || !scenario.ships.length) throw new Error("Fleet scenario requires an id and at least one ship");
  const ids = new Set<string>();
  const roles = new Set<string>();
  for (const ship of scenario.ships) {
    if (ids.has(ship.instanceId)) throw new Error(`Duplicate fleet ship: ${ship.instanceId}`);
    ids.add(ship.instanceId);
    if (!ship.definitionId) throw new Error(`Fleet ship ${ship.instanceId} has no definition`);
    for (const role of ship.commandRoles) {
      if (roles.has(role)) throw new Error(`Duplicate fleet command role: ${role}`);
      roles.add(role);
    }
  }
  if (!roles.has("otc")) throw new Error(`Fleet ${scenario.id} has no OTC`);
}

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

export function blueNtuScreenForFlagship(definitionId: string, formation: FleetFormation = "screen"): NavalForceScenario {
  const base = NAVAL_FORCE_SCENARIOS["blue-ntu-screen"];
  if (definitionId === "long-beach") {
    if (formation === base.formation) return base;
    return { ...base, formation, ships: base.ships.map(({ station: _station, ...ship }) => ship) };
  }
  const flagship = base.ships.find((ship) => ship.definitionId === definitionId);
  if (!flagship) throw new Error(`No NTU fleet station for flagship definition: ${definitionId}`);
  const escorts = base.ships.filter((ship) => ship.definitionId !== definitionId);
  return {
    ...base,
    id: `${base.id}-${definitionId}-flagship`,
    formation,
    ships: [
      {
        ...flagship,
        position: base.ships[0].position,
        station: formation === "screen" ? [0, 0, 0] : undefined,
        formationRole: "command",
        commandRoles: ["otc", "aawc"],
      },
      ...escorts.map((ship, index) => ({
        ...ship,
        position: [-180 - index * 70, 0, -80 - index * 60] as const,
        station: formation === "screen" ? [-180 - index * 70, 0, -120 - index * 60] as const : undefined,
        formationRole: "picket" as const,
        commandRoles: ["asuwc"] as const,
      })),
    ],
  };
}
