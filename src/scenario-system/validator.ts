import { DATALINK_ERAS } from "../datalink/era.js";
import { LOST_COMMS_DOCTRINES } from "../lost-comms/doctrine-catalog.js";
import { SOVIET_COMMAND_ERAS } from "../soviet-c2/era.js";
import { SPACE_WEATHER_PRESETS } from "../space-weather/catalog.js";
import type { ScenarioDocument, ScenarioValidationIssue, ScenarioValidationResult, ScenarioVec3 } from "./types.js";

const SIDES = new Set(["blue", "red", "neutral"]);
const FORCE_KINDS = new Set(["ship", "air-formation"]);
const FORMATION_ROLES = new Set(["command", "picket", "screen", "escort", "hvu"]);
const COMMAND_ROLES = new Set(["otc", "aawc", "asuwc"]);
const MISSIONS = new Set(["cap", "intercept", "escort", "anti-ship", "aew", "egress", "return"]);
const ROUTE_KINDS = new Set(["transit", "orbit", "attack", "rendezvous"]);
const ZONE_KINDS = new Set(["rendezvous", "launch-corridor", "weather-front", "magnetic-disturbance", "comms-window", "exclusion", "threat-estimate"]);
const TIMELINE_TYPES = new Set(["space-weather-phase", "comms-window", "objective", "guidance"]);
const WEATHER_PHASES = new Set(["quiet", "warning", "solar-flare", "degrading", "total-blackout", "intermittent", "recovery"]);
const OBJECTIVE_KINDS = new Set(["protect", "intercept", "survive", "observe", "strike"]);
const GUIDANCE_LEVELS = new Set(["full", "critical"]);
const GUIDANCE_CATEGORIES = new Set(["mission", "sensor", "network", "weather", "combat"]);
const TRIGGER_TYPES = new Set(["time", "space-weather-phase", "network-state", "platform-lost-comms", "confirmed-track", "weapon-launch", "objective-state", "inactivity"]);
const FOCUS_KINDS = new Set(["entity", "formation", "zone", "overview", "network"]);
const DEFAULT_AIR_PLATFORM_IDS = new Set(["F-14A", "TU-16K", "A-6E", "MIG-29A", "E-2C", "TU-126"]);

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteVec3 = (value: unknown): value is ScenarioVec3 => Array.isArray(value) && value.length === 3 && value.every(finite);
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);

export interface ScenarioValidationCatalogs {
  shipDefinitions?: ReadonlyMap<string, unknown> | ReadonlySet<string> | readonly string[];
  airDefinitions?: ReadonlySet<string> | readonly string[];
}

function definitionIds(input: ReadonlyMap<string, unknown> | ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) return new Set(input);
  return new Set((input as ReadonlyMap<string, unknown> | ReadonlySet<string>).keys());
}

export function validateScenarioDocument(input: unknown, catalogs: ScenarioValidationCatalogs = {}): ScenarioValidationResult {
  const issues: ScenarioValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  if (!record(input)) return { valid: false, issues: [{ path: "$", message: "Scenario must be an object" }] };
  const document = input;
  const knownShips = definitionIds(catalogs.shipDefinitions);
  const knownAir = definitionIds(catalogs.airDefinitions) ?? DEFAULT_AIR_PLATFORM_IDS;

  if (document.schemaVersion !== 1) fail("schemaVersion", "Only scenario schema version 1 is supported");
  if (!text(document.id)) fail("id", "Scenario id is required");

  if (!record(document.metadata)) fail("metadata", "Metadata object is required");
  else {
    if (!text(document.metadata.title)) fail("metadata.title", "Title is required");
    if (!text(document.metadata.description)) fail("metadata.description", "Description is required");
    if (!Number.isInteger(document.metadata.year) || Number(document.metadata.year) < 1900 || Number(document.metadata.year) > 2200) fail("metadata.year", "Year must be an integer in 1900..2200");
    if (!text(document.metadata.region)) fail("metadata.region", "Region is required");
    if (!stringArray(document.metadata.tags)) fail("metadata.tags", "Tags must be non-empty strings");
    if (typeof document.metadata.builtIn !== "boolean") fail("metadata.builtIn", "builtIn must be boolean");
  }

  if (!record(document.simulation)) fail("simulation", "Simulation config is required");
  else {
    if (!finite(document.simulation.seed)) fail("simulation.seed", "Finite deterministic seed is required");
    if (!finite(document.simulation.durationSeconds) || document.simulation.durationSeconds <= 0) fail("simulation.durationSeconds", "Positive duration is required");
    if (!finite(document.simulation.worldUnitsPerKm) || document.simulation.worldUnitsPerKm <= 0) fail("simulation.worldUnitsPerKm", "Positive world scale is required");
    if (!text(document.simulation.datalinkEra) || !(document.simulation.datalinkEra in DATALINK_ERAS)) fail("simulation.datalinkEra", "Unknown datalink era");
    if (!text(document.simulation.sovietCommandEra) || !(document.simulation.sovietCommandEra in SOVIET_COMMAND_ERAS)) fail("simulation.sovietCommandEra", "Unknown Soviet command era");
    if (typeof document.simulation.advancedAirAi !== "boolean") fail("simulation.advancedAirAi", "advancedAirAi must be boolean");
    if (typeof document.simulation.autoFire !== "boolean") fail("simulation.autoFire", "autoFire must be boolean");
  }

  if (!record(document.environment)) fail("environment", "Environment config is required");
  else {
    if (!text(document.environment.presetId)) fail("environment.presetId", "Environment preset id is required");
    if (document.environment.spaceWeatherPresetId !== undefined && (!text(document.environment.spaceWeatherPresetId) || !(document.environment.spaceWeatherPresetId in SPACE_WEATHER_PRESETS))) fail("environment.spaceWeatherPresetId", "Unknown space-weather preset");
    if (document.environment.auroraControlled !== undefined && typeof document.environment.auroraControlled !== "boolean") fail("environment.auroraControlled", "auroraControlled must be boolean");
  }

  const routes = Array.isArray(document.routes) ? document.routes : [];
  if (!Array.isArray(document.routes)) fail("routes", "Routes must be an array");
  const routeIds = new Set<string>();
  routes.forEach((route, index) => {
    const path = `routes[${index}]`;
    if (!record(route)) return fail(path, "Route must be an object");
    if (!text(route.id)) fail(`${path}.id`, "Route id is required");
    else if (routeIds.has(route.id)) fail(`${path}.id`, `Duplicate route id ${route.id}`); else routeIds.add(route.id);
    if (!ROUTE_KINDS.has(String(route.kind))) fail(`${path}.kind`, "Unknown route kind");
    if (route.loop !== undefined && typeof route.loop !== "boolean") fail(`${path}.loop`, "loop must be boolean");
    if (!Array.isArray(route.points) || route.points.length === 0) fail(`${path}.points`, "Route needs at least one point");
    else route.points.forEach((point, pointIndex) => {
      const pp = `${path}.points[${pointIndex}]`;
      if (!record(point)) return fail(pp, "Route point must be an object");
      if (!finiteVec3(point.position)) fail(`${pp}.position`, "Position must be a finite three-number tuple");
      if (point.speed !== undefined && (!finite(point.speed) || point.speed < 0)) fail(`${pp}.speed`, "Speed must be finite and non-negative");
      if (point.altitude !== undefined && (!finite(point.altitude) || point.altitude < 0)) fail(`${pp}.altitude`, "Altitude must be finite and non-negative");
    });
  });

  const forces = Array.isArray(document.forces) ? document.forces : [];
  if (!Array.isArray(document.forces) || forces.length === 0) fail("forces", "At least one force entity is required");
  const entityIds = new Set<string>();
  const forceIds = new Set<string>();
  forces.forEach((force, index) => {
    const path = `forces[${index}]`;
    if (!record(force)) return fail(path, "Force must be an object");
    if (!FORCE_KINDS.has(String(force.kind))) fail(`${path}.kind`, "Unknown force kind");
    if (!text(force.id)) fail(`${path}.id`, "Entity id is required");
    else if (entityIds.has(force.id)) fail(`${path}.id`, `Duplicate entity id ${force.id}`); else entityIds.add(force.id);
    if (!text(force.platformId)) fail(`${path}.platformId`, "Platform catalog id is required");
    else if (force.kind === "ship" && knownShips && !knownShips.has(force.platformId)) fail(`${path}.platformId`, `Unknown ship platform ${force.platformId}`);
    else if (force.kind === "air-formation" && !knownAir.has(force.platformId)) fail(`${path}.platformId`, `Unknown air platform ${force.platformId}`);
    if (!SIDES.has(String(force.side))) fail(`${path}.side`, "Unknown side");
    if (!finiteVec3(force.position)) fail(`${path}.position`, "Position must be a finite three-number tuple");
    if (!finite(force.headingDeg) || force.headingDeg < 0 || force.headingDeg >= 360) fail(`${path}.headingDeg`, "Heading must be in [0, 360) true-north degrees");
    if (force.routeId !== undefined && (!text(force.routeId) || !routeIds.has(force.routeId))) fail(`${path}.routeId`, `Unknown route ${String(force.routeId)}`);
    if (force.lostCommsDoctrineId !== undefined && (!text(force.lostCommsDoctrineId) || !(force.lostCommsDoctrineId in LOST_COMMS_DOCTRINES))) fail(`${path}.lostCommsDoctrineId`, `Unknown lost-comms doctrine ${String(force.lostCommsDoctrineId)}`);
    if (force.radarState !== undefined && force.radarState !== "active" && force.radarState !== "silent") fail(`${path}.radarState`, "radarState must be active or silent");
    if (force.kind === "ship") {
      if (!text(force.forceId)) fail(`${path}.forceId`, "Ship forceId is required");
      else forceIds.add(force.forceId);
      if (!finite(force.speedKnots) || force.speedKnots < 0 || force.speedKnots > 80) fail(`${path}.speedKnots`, "Ship speed must be in 0..80 knots");
      if (!FORMATION_ROLES.has(String(force.formationRole))) fail(`${path}.formationRole`, "Unknown formation role");
      if (!Array.isArray(force.commandRoles) || !force.commandRoles.every((role) => COMMAND_ROLES.has(String(role)))) fail(`${path}.commandRoles`, "Invalid command roles");
      if (force.ecmEnabled !== undefined && typeof force.ecmEnabled !== "boolean") fail(`${path}.ecmEnabled`, "ecmEnabled must be boolean");
      if (force.loadout !== undefined && (!record(force.loadout) || Object.values(force.loadout).some((count) => !Number.isInteger(count) || Number(count) < 0))) fail(`${path}.loadout`, "Loadout counts must be non-negative integers");
    } else if (force.kind === "air-formation") {
      if (!Number.isInteger(force.count) || Number(force.count) < 1 || Number(force.count) > 12) fail(`${path}.count`, "Air formation count must be 1..12");
      if (!finite(force.altitude) || force.altitude < 0) fail(`${path}.altitude`, "Altitude must be finite and non-negative");
      if (force.speed !== undefined && (!finite(force.speed) || force.speed < 0)) fail(`${path}.speed`, "Speed must be finite and non-negative");
      if (!MISSIONS.has(String(force.mission))) fail(`${path}.mission`, "Unknown air mission");
    }
  });
  forces.forEach((force, index) => {
    if (record(force) && force.protectedFormationId !== undefined && (!text(force.protectedFormationId) || !entityIds.has(force.protectedFormationId))) fail(`forces[${index}].protectedFormationId`, `Unknown protected formation ${String(force.protectedFormationId)}`);
  });

  const zones = Array.isArray(document.zones) ? document.zones : [];
  if (!Array.isArray(document.zones)) fail("zones", "Zones must be an array");
  const zoneIds = new Set<string>();
  zones.forEach((zone, index) => {
    const path = `zones[${index}]`;
    if (!record(zone)) return fail(path, "Zone must be an object");
    if (!text(zone.id)) fail(`${path}.id`, "Zone id is required"); else if (zoneIds.has(zone.id)) fail(`${path}.id`, `Duplicate zone id ${zone.id}`); else zoneIds.add(zone.id);
    if (!ZONE_KINDS.has(String(zone.kind))) fail(`${path}.kind`, "Unknown zone kind");
    if (!finiteVec3(zone.center)) fail(`${path}.center`, "Zone center must be a finite three-number tuple");
    if (!finite(zone.radius) || zone.radius <= 0) fail(`${path}.radius`, "Zone radius must be positive");
    if (zone.side !== undefined && !SIDES.has(String(zone.side))) fail(`${path}.side`, "Unknown side");
    if (zone.visibleInBriefing !== undefined && typeof zone.visibleInBriefing !== "boolean") fail(`${path}.visibleInBriefing`, "visibleInBriefing must be boolean");
  });

  const objectives = Array.isArray(document.objectives) ? document.objectives : [];
  if (!Array.isArray(document.objectives)) fail("objectives", "Objectives must be an array");
  const objectiveIds = new Set<string>();
  objectives.forEach((objective, index) => {
    const path = `objectives[${index}]`;
    if (!record(objective)) return fail(path, "Objective must be an object");
    if (!text(objective.id)) fail(`${path}.id`, "Objective id is required"); else if (objectiveIds.has(objective.id)) fail(`${path}.id`, `Duplicate objective id ${objective.id}`); else objectiveIds.add(objective.id);
    if (!SIDES.has(String(objective.side))) fail(`${path}.side`, "Unknown side");
    if (!text(objective.title)) fail(`${path}.title`, "Objective title is required");
    if (!text(objective.description)) fail(`${path}.description`, "Objective description is required");
    if (!OBJECTIVE_KINDS.has(String(objective.kind))) fail(`${path}.kind`, "Unknown objective kind");
    if (!Array.isArray(objective.targetIds) || objective.targetIds.length === 0) fail(`${path}.targetIds`, "Objective needs targets");
    else objective.targetIds.forEach((target) => { if (!text(target) || !entityIds.has(target)) fail(`${path}.targetIds`, `Unknown target ${String(target)}`); });
  });

  const timeline = Array.isArray(document.timeline) ? document.timeline : [];
  if (!Array.isArray(document.timeline) || timeline.length === 0) fail("timeline", "Timeline needs at least one event");
  const timelineIds = new Set<string>();
  timeline.forEach((event, index) => {
    const path = `timeline[${index}]`;
    if (!record(event)) return fail(path, "Timeline event must be an object");
    if (!text(event.id)) fail(`${path}.id`, "Timeline event id is required"); else if (timelineIds.has(event.id)) fail(`${path}.id`, `Duplicate timeline id ${event.id}`); else timelineIds.add(event.id);
    if (!finite(event.at) || event.at < 0 || (record(document.simulation) && finite(document.simulation.durationSeconds) && event.at > document.simulation.durationSeconds)) fail(`${path}.at`, "Timeline time must be within scenario duration");
    if (!TIMELINE_TYPES.has(String(event.type))) fail(`${path}.type`, "Unknown timeline event type");
    if (!text(event.value)) fail(`${path}.value`, "Timeline value is required");
    if (event.duration !== undefined && (!finite(event.duration) || event.duration <= 0)) fail(`${path}.duration`, "Duration must be positive");
    if (event.type === "space-weather-phase" && !WEATHER_PHASES.has(String(event.value))) fail(`${path}.value`, "Unknown space-weather phase");
    if (event.type === "comms-window") {
      if (!finite(event.duration) || event.duration <= 0) fail(`${path}.duration`, "Communication window requires positive duration");
      if (!text(event.value) || !finite(Number(event.value)) || Number(event.value) <= 0 || Number(event.value) > 1) fail(`${path}.value`, "Communication window value must be a strength in (0, 1]");
      if (finite(event.at) && finite(event.duration) && record(document.simulation) && finite(document.simulation.durationSeconds) && event.at + event.duration > document.simulation.durationSeconds) fail(`${path}.duration`, "Communication window exceeds scenario duration");
    }
    if (event.type === "objective" && text(event.value) && !objectiveIds.has(event.value)) fail(`${path}.value`, `Unknown objective ${event.value}`);
  });
  const weatherEvents = timeline.filter((event) => record(event) && event.type === "space-weather-phase")
    .sort((left, right) => Number(left.at) - Number(right.at));
  if (!weatherEvents.length || weatherEvents[0].at !== 0) fail("timeline", "Space-weather timeline must begin at t=0");
  for (let index = 1; index < weatherEvents.length; index++)
    if (weatherEvents[index].at === weatherEvents[index - 1].at) fail("timeline", "Space-weather phase transitions need unique times");
  const windows = timeline.filter((event) => record(event) && event.type === "comms-window" && finite(event.at) && finite(event.duration))
    .sort((left, right) => Number(left.at) - Number(right.at));
  for (let index = 1; index < windows.length; index++)
    if (Number(windows[index].at) < Number(windows[index - 1].at) + Number(windows[index - 1].duration)) fail("timeline", "Communication windows must not overlap");

  if (!record(document.guidance)) fail("guidance", "Guidance definition is required");
  else {
    if (!record(document.guidance.briefing)) fail("guidance.briefing", "Briefing is required");
    else for (const key of ["strategicBackground", "blueMission", "intelligenceEstimate", "features", "controls"])
      if (!stringArray(document.guidance.briefing[key])) fail(`guidance.briefing.${key}`, "Briefing section must be an array of strings");
    if (document.guidance.estimatedContactWindow !== undefined && (!Array.isArray(document.guidance.estimatedContactWindow) || document.guidance.estimatedContactWindow.length !== 2 || !document.guidance.estimatedContactWindow.every(finite) || document.guidance.estimatedContactWindow[0] > document.guidance.estimatedContactWindow[1])) fail("guidance.estimatedContactWindow", "Contact window must be an ordered two-number tuple");
    if (!Array.isArray(document.guidance.cues)) fail("guidance.cues", "Guidance cues must be an array");
    else {
      const cueIds = new Set<string>();
      document.guidance.cues.forEach((cue, index) => {
        const path = `guidance.cues[${index}]`;
        if (!record(cue)) return fail(path, "Guidance cue must be an object");
        if (!text(cue.id)) fail(`${path}.id`, "Cue id is required"); else if (cueIds.has(cue.id)) fail(`${path}.id`, `Duplicate cue id ${cue.id}`); else cueIds.add(cue.id);
        if (!GUIDANCE_LEVELS.has(String(cue.level))) fail(`${path}.level`, "Unknown guidance level");
        if (!text(cue.title) || !text(cue.message)) fail(path, "Cue title and message are required");
        if (!GUIDANCE_CATEGORIES.has(String(cue.category))) fail(`${path}.category`, "Unknown cue category");
        if (typeof cue.once !== "boolean") fail(`${path}.once`, "once must be boolean");
        if (cue.expiresAfter !== undefined && (!finite(cue.expiresAfter) || cue.expiresAfter <= 0)) fail(`${path}.expiresAfter`, "Expiry must be positive");
        if (!record(cue.trigger) || !TRIGGER_TYPES.has(String(cue.trigger.type))) fail(`${path}.trigger`, "Unknown guidance trigger");
        else {
          if (cue.trigger.type === "time" && (!finite(cue.trigger.at) || cue.trigger.at < 0)) fail(`${path}.trigger.at`, "Trigger time must be non-negative");
          if (cue.trigger.type === "space-weather-phase" && !WEATHER_PHASES.has(String(cue.trigger.phase))) fail(`${path}.trigger.phase`, "Unknown weather phase");
          if (cue.trigger.type === "platform-lost-comms" && (!text(cue.trigger.platformId) || !entityIds.has(cue.trigger.platformId))) fail(`${path}.trigger.platformId`, "Unknown platform");
          if (cue.trigger.type === "objective-state" && (!text(cue.trigger.objectiveId) || !objectiveIds.has(cue.trigger.objectiveId))) fail(`${path}.trigger.objectiveId`, "Unknown objective");
          if (cue.trigger.type === "inactivity" && (!finite(cue.trigger.seconds) || cue.trigger.seconds <= 0)) fail(`${path}.trigger.seconds`, "Inactivity must be positive");
        }
        if (cue.focus !== undefined) {
          if (!record(cue.focus) || !FOCUS_KINDS.has(String(cue.focus.kind)) || !text(cue.focus.label)) fail(`${path}.focus`, "Invalid guidance focus");
          else if (cue.focus.targetId !== undefined) {
            const known = entityIds.has(String(cue.focus.targetId)) || zoneIds.has(String(cue.focus.targetId)) || forceIds.has(String(cue.focus.targetId));
            if (!known) fail(`${path}.focus.targetId`, `Unknown focus target ${String(cue.focus.targetId)}`);
          }
        }
      });
    }
  }
  return { valid: issues.length === 0, issues };
}

export function assertScenarioDocument(input: unknown, catalogs: ScenarioValidationCatalogs = {}): asserts input is ScenarioDocument {
  const result = validateScenarioDocument(input, catalogs);
  if (!result.valid) throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
}
