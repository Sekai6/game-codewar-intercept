import * as THREE from "three";
import { AIR_PLATFORM_BY_ID } from "../air/catalog.js";
import type { AirPlatformId, AirSpawn } from "../air/types.js";
import type { DatalinkEra } from "../datalink/era.js";
import { DATALINK_ERAS } from "../datalink/era.js";
import { SOVIET_COMMAND_ERAS } from "../soviet-c2/era.js";
import { SPACE_WEATHER_PRESETS } from "../space-weather/catalog.js";
import type { SpaceWeatherKeyframe, SpaceWeatherPhase, SpaceWeatherPreset } from "../space-weather/types.js";
import { LOST_COMMS_DOCTRINES } from "../lost-comms/doctrine-catalog.js";
import type { NavalForceScenario } from "../fleet/types.js";
import type { ShipDefinition } from "../ship-types.js";
import { normalizeScenarioDocument } from "./normalizer.js";
import type { ScenarioDocument, ScenarioShipDefinition } from "./types.js";

type BelligerentShip = ScenarioShipDefinition & { side: "blue" | "red" };

export interface CompiledScenario {
  document: ScenarioDocument;
  navalForces: readonly NavalForceScenario[];
  surfacePlatformSpawns: readonly {
    id: string;
    platformId: string;
    side: "red";
    position: THREE.Vector3;
    heading: number;
    speedKnots: number;
    routeId?: string;
    lostCommsDoctrineId?: string;
  }[];
  airSpawns: readonly AirSpawn[];
  routes: ReadonlyMap<string, CompiledScenarioRoute>;
  initialStates: ReadonlyMap<string, CompiledPlatformInitialState>;
  timeline: CompiledScenarioTimeline;
}

export interface CompiledScenarioRoute {
  id: string;
  kind: ScenarioDocument["routes"][number]["kind"];
  loop: boolean;
  points: readonly { position: THREE.Vector3; speed?: number; altitude?: number }[];
}

export interface CompiledPlatformInitialState {
  entityId: string;
  speed: number;
  altitude: number;
  radarState: "active" | "silent";
  ecmEnabled: boolean;
  routeId?: string;
  route?: CompiledScenarioRoute;
}

export interface CompiledScenarioTimeline {
  events: ScenarioDocument["timeline"];
  spaceWeather: SpaceWeatherPreset;
}

export interface ScenarioCompilerOptions {
  shipDefinitions?: ReadonlyMap<string, ShipDefinition> | ReadonlySet<string> | readonly string[];
}

function catalogIds(input: ScenarioCompilerOptions["shipDefinitions"]): ReadonlySet<string> | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) return new Set(input);
  return new Set((input as ReadonlyMap<string, ShipDefinition> | ReadonlySet<string>).keys());
}

/** Converts true-north clockwise degrees to the ship runtime's +X-zero radians. */
export function trueHeadingToShipRadians(headingDeg: number): number {
  return THREE.MathUtils.degToRad(90 - headingDeg);
}

/** Converts true-north clockwise degrees to a normalized Three.js world heading. */
export function trueHeadingToWorldVector(headingDeg: number): THREE.Vector3 {
  const radians = THREE.MathUtils.degToRad(headingDeg);
  return new THREE.Vector3(Math.sin(radians), 0, -Math.cos(radians)).normalize();
}

function compileNavalForces(document: ScenarioDocument): NavalForceScenario[] {
  const ships = document.forces.filter((force): force is BelligerentShip =>
    force.kind === "ship" && force.side === "blue");
  const grouped = new Map<string, BelligerentShip[]>();
  for (const ship of ships) {
    const key = `${ship.side}:${ship.forceId}`;
    const group = grouped.get(key) ?? [];
    group.push(ship);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => {
    const command = group.find((ship) => ship.formationRole === "command") ?? group[0];
    return {
      id: command.forceId,
      label: `${document.metadata.title} / ${command.forceId}`,
      side: command.side,
      doctrineId: command.side === "blue" ? "us-ntu-link11" : "soviet-autonomous",
      datalinkEra: document.simulation.datalinkEra as DatalinkEra,
      formation: group.some((ship) => ship.formationRole === "picket") ? "screen" : "dispersed",
      ships: group.map((ship) => {
        const route = ship.routeId ? document.routes.find((candidate) => candidate.id === ship.routeId) : undefined;
        return ({
        instanceId: ship.id,
        definitionId: ship.platformId,
        position: ship.position,
        station: [
          ship.position[0] - command.position[0],
          ship.position[1] - command.position[1],
          ship.position[2] - command.position[2],
        ] as const,
        heading: trueHeadingToShipRadians(ship.headingDeg),
        formationRole: ship.formationRole,
        commandRoles: ship.commandRoles,
        initialSpeedKnots: ship.speedKnots,
        scenarioRoute: route?.points.map((point) => point.position),
        scenarioRouteLoop: route?.loop ?? false,
        loadout: ship.loadout,
      }); }),
    };
  });
}

function compileRoutes(document: ScenarioDocument): ReadonlyMap<string, CompiledScenarioRoute> {
  return new Map(document.routes.map((route) => [route.id, {
    id: route.id,
    kind: route.kind,
    loop: route.loop ?? false,
    points: route.points.map((point) => ({
      position: new THREE.Vector3(...point.position),
      speed: point.speed,
      altitude: point.altitude,
    })),
  }]));
}

function compileInitialStates(document: ScenarioDocument, routes: ReadonlyMap<string, CompiledScenarioRoute>): ReadonlyMap<string, CompiledPlatformInitialState> {
  return new Map(document.forces.map((force) => {
    const route = force.routeId ? routes.get(force.routeId) : undefined;
    return [force.id, {
      entityId: force.id,
      speed: force.kind === "ship" ? force.speedKnots : (force.speed ?? AIR_PLATFORM_BY_ID[force.platformId as AirPlatformId]?.flight.cruiseSpeed ?? 0),
      altitude: force.kind === "ship" ? force.position[1] : force.altitude,
      radarState: force.radarState ?? "active",
      ecmEnabled: force.kind === "ship" ? (force.ecmEnabled ?? true) : true,
      routeId: force.routeId,
      route,
    }];
  }));
}

function phaseFrame(preset: SpaceWeatherPreset, phase: SpaceWeatherPhase, at: number): SpaceWeatherKeyframe {
  const source = preset.keyframes.find((frame) => frame.phase === phase);
  if (!source) throw new Error(`Preset ${preset.id} has no values for phase ${phase}`);
  return { ...source, at };
}

function compileTimeline(document: ScenarioDocument): CompiledScenarioTimeline {
  const presetId = document.environment.spaceWeatherPresetId;
  if (!presetId || !(presetId in SPACE_WEATHER_PRESETS)) throw new Error("Scenario timeline requires a valid space-weather preset");
  const base = SPACE_WEATHER_PRESETS[presetId as keyof typeof SPACE_WEATHER_PRESETS];
  const phaseEvents = document.timeline.filter((event) => event.type === "space-weather-phase");
  const windowEvents = document.timeline.filter((event) => event.type === "comms-window");
  const keyframes = phaseEvents.map((event) => phaseFrame(base, event.value as SpaceWeatherPhase, event.at));
  const communicationWindows = windowEvents.map((event) => ({
    start: event.at,
    end: event.at + (event.duration ?? 0),
    strength: Number(event.value),
  }));
  return {
    events: document.timeline,
    spaceWeather: {
      ...base,
      durationSeconds: document.simulation.durationSeconds,
      keyframes,
      communicationWindows,
    },
  };
}

function compileSurfacePlatforms(document: ScenarioDocument): CompiledScenario["surfacePlatformSpawns"] {
  return document.forces.flatMap((force) => force.kind === "ship" && force.side === "red" ? [{
    id: force.id,
    platformId: force.platformId,
    side: "red" as const,
    position: new THREE.Vector3(...force.position),
    heading: trueHeadingToShipRadians(force.headingDeg),
    speedKnots: force.speedKnots,
    routeId: force.routeId,
    lostCommsDoctrineId: force.lostCommsDoctrineId,
  }] : []);
}

function compileAirSpawns(document: ScenarioDocument): AirSpawn[] {
  return document.forces.flatMap((force): AirSpawn[] => {
    if (force.kind !== "air-formation" || force.side === "neutral") return [];
    const side = force.side;
    const definition = AIR_PLATFORM_BY_ID[force.platformId as AirPlatformId];
    if (!definition) throw new Error(`Unknown air platform ${force.platformId} for ${force.id}`);
    const heading = trueHeadingToWorldVector(force.headingDeg);
    const route = force.routeId ? document.routes.find((candidate) => candidate.id === force.routeId) : undefined;
    const launchZone = force.mission === "anti-ship"
      ? document.zones.find((zone) => zone.kind === "launch-corridor" && (!zone.side || zone.side === side))
      : undefined;
    const right = new THREE.Vector3(-heading.z, 0, heading.x);
    return Array.from({ length: force.count }, (_, formationIndex) => {
      const row = Math.floor(formationIndex / 2);
      const lateralSide = formationIndex % 2 === 0 ? -1 : 1;
      const spacing = force.count === 1 ? 0 : 12 + row * 5;
      const position = new THREE.Vector3(force.position[0], force.altitude, force.position[2])
        .addScaledVector(right, lateralSide * spacing)
        .addScaledVector(heading, -row * 10);
      position.y += formationIndex % 2 === 0 ? 0 : 2;
      return {
        definition,
        side,
        formationId: force.id,
        position,
        heading: heading.clone(),
        formationIndex,
        leaderId: formationIndex === 0 ? undefined : `${force.id}-1`,
        mission: force.mission,
        protectedFormationId: force.protectedFormationId,
        scenarioRoute: route?.points.map((point) => new THREE.Vector3(...point.position)),
        scenarioRouteLoop: route?.loop ?? false,
        scenarioLaunchZone: launchZone
          ? { center:new THREE.Vector3(...launchZone.center), radius:launchZone.radius }
          : undefined,
        initialSpeed: force.speed,
      };
    });
  });
}

export function compileScenario(input: unknown, options: ScenarioCompilerOptions = {}): CompiledScenario {
  const document = normalizeScenarioDocument(input);
  if (!(document.simulation.datalinkEra in DATALINK_ERAS))
    throw new Error(`Unknown datalink era ${document.simulation.datalinkEra}`);
  if (!(document.simulation.sovietCommandEra in SOVIET_COMMAND_ERAS))
    throw new Error(`Unknown Soviet command era ${document.simulation.sovietCommandEra}`);
  if (document.environment.spaceWeatherPresetId && !(document.environment.spaceWeatherPresetId in SPACE_WEATHER_PRESETS))
    throw new Error(`Unknown space-weather preset ${document.environment.spaceWeatherPresetId}`);
  for (const force of document.forces)
    if (force.lostCommsDoctrineId && !(force.lostCommsDoctrineId in LOST_COMMS_DOCTRINES))
      throw new Error(`Unknown lost-comms doctrine ${force.lostCommsDoctrineId} for ${force.id}`);
  const knownShips = catalogIds(options.shipDefinitions);
  if (knownShips) for (const force of document.forces) {
    if (force.kind === "ship" && !knownShips.has(force.platformId))
      throw new Error(`Unknown ship platform ${force.platformId} for ${force.id}`);
  }
  const routes = compileRoutes(document);
  return {
    document,
    navalForces: compileNavalForces(document),
    surfacePlatformSpawns: compileSurfacePlatforms(document),
    airSpawns: compileAirSpawns(document),
    routes,
    initialStates: compileInitialStates(document, routes),
    timeline: compileTimeline(document),
  };
}
