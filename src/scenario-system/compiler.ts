import * as THREE from "three";
import { AIR_PLATFORM_BY_ID } from "../air/catalog.js";
import type { AirPlatformId, AirSpawn } from "../air/types.js";
import type { DatalinkEra } from "../datalink/era.js";
import { DATALINK_ERAS } from "../datalink/era.js";
import { SOVIET_COMMAND_ERAS } from "../soviet-c2/era.js";
import { SPACE_WEATHER_PRESETS } from "../space-weather/catalog.js";
import type { SpaceWeatherPhase, SpaceWeatherPreset } from "../space-weather/types.js";
import { retimeSpaceWeatherKeyframes } from "../space-weather/timeline-runtime.js";
import { LOST_COMMS_DOCTRINES } from "../lost-comms/doctrine-catalog.js";
import type { NavalForceScenario } from "../fleet/types.js";
import type { ShipDefinition } from "../ship-types.js";
import { normalizeScenarioDocument } from "./normalizer.js";
import type { ScenarioDocument, ScenarioShipDefinition } from "./types.js";
import { WeatherFrontRuntime } from "../environment/weather-front-runtime.js";
import { formationSlotForIndex } from "../air/formation.js";

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
  threatWaves: readonly CompiledThreatWave[];
  routes: ReadonlyMap<string, CompiledScenarioRoute>;
  initialStates: ReadonlyMap<string, CompiledPlatformInitialState>;
  timeline: CompiledScenarioTimeline;
  weatherFronts: WeatherFrontRuntime;
}

export interface CompiledThreatWave {
  id: string;
  threatId: string;
  side: "blue" | "red";
  source: "in-flight" | "surface-platform";
  sourcePlatformId?: string;
  count: number;
  firstLaunchAt: number;
  intervalSeconds: number;
  origin: THREE.Vector3;
  altitude: number;
  spread: number;
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
    force.kind === "ship" && force.side !== "neutral");
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

function compileTimeline(document: ScenarioDocument): CompiledScenarioTimeline {
  const presetId = document.environment.spaceWeatherPresetId;
  if (!presetId) {
    return {
      events: document.timeline,
      spaceWeather: {
        id: "scenario-quiet",
        scenarioSeed: document.simulation.seed,
        label: "Quiet ionosphere",
        durationSeconds: document.simulation.durationSeconds,
        keyframes: [{ at: 0, phase: "quiet", intensity: 0, hfAvailability: 1, vhfUhfReliability: 1, satelliteReliability: 1, gnssQuality: 1, radarNoise: 0, ionosphericScintillation: 0, magneticDisturbance: 0 }],
        communicationWindows: [],
      },
    };
  }
  if (!(presetId in SPACE_WEATHER_PRESETS)) throw new Error("Scenario timeline requires a valid space-weather preset");
  const base = SPACE_WEATHER_PRESETS[presetId as keyof typeof SPACE_WEATHER_PRESETS];
  const phaseEvents = document.timeline.filter((event) => event.type === "space-weather-phase");
  const windowEvents = document.timeline.filter((event) => event.type === "comms-window");
  const keyframes = retimeSpaceWeatherKeyframes(base, phaseEvents.map((event) => ({
    at: event.at,
    phase: event.value as SpaceWeatherPhase,
  })), document.simulation.durationSeconds);
  const communicationWindows = windowEvents.map((event) => ({
    start: event.at,
    end: event.at + (event.duration ?? 0),
    strength: Number(event.value),
  }));
  return {
    events: document.timeline,
    spaceWeather: {
      ...base,
      scenarioSeed: document.simulation.seed,
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
    const deploymentZone = force.deployment
      ? document.zones.find((zone) => zone.id === force.deployment!.zoneId)
      : undefined;
    const basePosition = deploymentZone
      ? seededDeploymentPosition(document.simulation.seed, force.deployment?.groupId ?? force.id, deploymentZone.center, deploymentZone.radius, force.deployment?.minRadiusFactor, force.deployment?.maxRadiusFactor)
      : new THREE.Vector3(...force.position);
    if(force.deployment?.offset)basePosition.add(new THREE.Vector3(...force.deployment.offset));
    basePosition.y = force.altitude;
    const configuredPosition = new THREE.Vector3(force.position[0], force.altitude, force.position[2]);
    const deploymentOffset = basePosition.clone().sub(configuredPosition);
    const scenarioRoute = route?.points.map((point, index) => {
      const position = new THREE.Vector3(...point.position);
      if (!deploymentZone || !route) return position;
      const routeMode = force.deployment?.routeMode ?? (route.loop ? "translate" : "converge");
      const weight = routeMode === "translate" ? 1 : 1 - index / Math.max(1, route.points.length - 1);
      return position.addScaledVector(deploymentOffset, weight);
    });
    const launchZone = force.mission === "anti-ship"
      ? force.launchZoneId
        ? document.zones.find((zone) => zone.id === force.launchZoneId)
        : document.zones.find((zone) => zone.kind === "launch-corridor" && (!zone.side || zone.side === side))
      : undefined;
    const exitZone = force.exitZoneId
      ? document.zones.find((zone) => zone.id === force.exitZoneId)
      : undefined;
    const strikeWave = force.strikeWaveId
      ? document.strikeWaves?.find((wave) => wave.id === force.strikeWaveId)
      : undefined;
    return Array.from({ length: force.count }, (_, formationIndex) => {
      const leaderPosition = new THREE.Vector3(
        basePosition.x,
        basePosition.y,
        basePosition.z,
      );
      const slot = formationSlotForIndex({
        leader: leaderPosition,
        leaderHeading: heading,
        formationIndex,
      });
      const position = new THREE.Vector3(slot.x, slot.y, slot.z);
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
        scenarioRoute,
        scenarioRouteLoop: route?.loop ?? false,
        scenarioLaunchZone: launchZone
          ? { center:new THREE.Vector3(...launchZone.center), radius:launchZone.radius }
          : undefined,
        scenarioStrikeWaveId: force.strikeWaveId,
        scenarioStrikeWave: strikeWave,
        scenarioWeaponsHoldUntil: force.weaponsHoldUntil,
        scenarioExitZone: exitZone
          ? { center: new THREE.Vector3(...exitZone.center), radius: exitZone.radius }
          : undefined,
        initialSpeed: force.speed,
        initialRadarState: force.radarState,
        initialEcmEnabled: force.ecmEnabled,
        initialLoadout: force.loadout,
      };
    });
  });
}

function hashSeed(seed:number,value:string) {
  let hash=(seed^0x9e3779b9)>>>0;
  for(let index=0;index<value.length;index++){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,0x85ebca6b)>>>0;
    hash^=hash>>>13;
  }
  return hash>>>0;
}

function seededUnit(seed:number) {
  let value=seed>>>0;
  return ()=>{
    value=(value+0x6d2b79f5)>>>0;
    let mixed=value;
    mixed=Math.imul(mixed^(mixed>>>15),mixed|1);
    mixed^=mixed+Math.imul(mixed^(mixed>>>7),mixed|61);
    return ((mixed^(mixed>>>14))>>>0)/4294967296;
  };
}

function seededDeploymentPosition(seed:number,id:string,center:readonly [number,number,number],radius:number,minFactor=.25,maxFactor=.9) {
  const random=seededUnit(hashSeed(seed,`deployment:${id}`));
  const inner=Math.max(0,Math.min(1,minFactor));
  const outer=Math.max(inner,Math.min(1,maxFactor));
  const radialFactor=Math.sqrt(inner*inner+random()*(outer*outer-inner*inner));
  const angle=random()*Math.PI*2;
  return new THREE.Vector3(center[0]+Math.cos(angle)*radius*radialFactor,center[1],center[2]+Math.sin(angle)*radius*radialFactor);
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
    threatWaves: (document.threatWaves ?? []).map((wave) => ({ ...wave, origin: new THREE.Vector3(...wave.origin) })),
    routes,
    initialStates: compileInitialStates(document, routes),
    timeline: compileTimeline(document),
    weatherFronts: new WeatherFrontRuntime(document.zones, document.simulation.seed),
  };
}
