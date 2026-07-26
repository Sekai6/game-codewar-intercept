import * as THREE from "three";
import type { ShipDefinition } from "../ship-types.js";
import { createShipCombatant } from "../ships/ship-runtime.js";
import { FLEET_DOCTRINES } from "./doctrine.js";
import { defaultFormationStation } from "./formation-presets.js";
import type { FleetCommandRole, NavalForceRuntime, NavalForceScenario } from "./types.js";

export function createNavalForceRuntime(
  scenario: NavalForceScenario,
  definitions: ReadonlyMap<string, ShipDefinition>,
  modelOverrides: ReadonlyMap<string, THREE.Group> = new Map(),
): NavalForceRuntime {
  const doctrine = FLEET_DOCTRINES[scenario.doctrineId];
  if (!doctrine) throw new Error(`Unknown fleet doctrine: ${scenario.doctrineId}`);
  const ships = new Map();
  const commandRoles = new Map<FleetCommandRole, string>();
  const formationRoles = new Map();
  const stations = new Map();
  for (const entry of scenario.ships) {
    if (ships.has(entry.instanceId)) throw new Error(`Duplicate fleet ship: ${entry.instanceId}`);
    const definition = definitions.get(entry.definitionId);
    if (!definition) throw new Error(`Unknown ship definition: ${entry.definitionId}`);
    const ship = createShipCombatant({
      id: entry.instanceId,
      forceId: scenario.id,
      side: scenario.side,
      definition,
      model: modelOverrides.get(entry.instanceId),
      preserveModelTransform: modelOverrides.has(entry.instanceId),
      position: new THREE.Vector3(...entry.position),
      heading: entry.heading,
      initialSpeedKnots: entry.initialSpeedKnots,
      loadout: entry.loadout,
    });
    ships.set(ship.id, ship);
    formationRoles.set(ship.id, entry.formationRole);
    stations.set(ship.id, entry.station ?? defaultFormationStation(scenario.formation, ships.size - 1, entry.formationRole));
    for (const role of entry.commandRoles) {
      if (commandRoles.has(role)) throw new Error(`Duplicate fleet command role: ${role}`);
      commandRoles.set(role, ship.id);
    }
  }
  if (!commandRoles.has("otc")) throw new Error(`Fleet ${scenario.id} has no OTC`);
  const anchorShipId = commandRoles.get("otc")!;
  const anchor = ships.get(anchorShipId)!;
  return {
    id: scenario.id,
    side: scenario.side,
    doctrine,
    datalinkEra: scenario.datalinkEra,
    formation: scenario.formation,
    ships,
    stations,
    formationRoles,
    commandRoles,
    formationState: {
      anchorShipId,
      heading: anchor.heading,
      speedKnots: anchor.speedKnots,
      stations: new Map(),
      lastCommandReassessmentAt: Number.NEGATIVE_INFINITY,
    },
    picture: new Map(),
    assignments: new Map(),
    engagements: new Map(),
    surfaceAssignments: new Map(),
  };
}
