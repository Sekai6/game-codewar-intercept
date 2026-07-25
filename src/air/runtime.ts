import * as THREE from "three";
import { createAirWeaponModel } from "../models/air-weapons.js";
import type { CombatEntity, TargetableEntity } from "../combat-entity";
import { AIR_WEAPONS } from "./catalog";
import { airRadarFactors, missileWarningProbability } from "./sensors";
import {
  infraredSeekerCaptureProbability,
  radarSeekerCaptureProbability,
  seekerMeasurementPoint,
  semiActiveIlluminationValid,
} from "./guidance";
import { consumeFuel, stepFlightDynamics } from "./flight-dynamics";
import { stepFlightDirector } from "./ai/flight-director.js";
import { initialAdvancedFlightState } from "./flight/aircraft-performance.js";
import { initialAirTacticalState, transitionTacticalState } from "./ai/tactical-state.js";
import { planBvrManeuver } from "./ai/tactical-planner.js";
import { planBfmManeuver } from "./ai/bfm-planner.js";
import { planDamageFlight } from "./ai/damage-management.js";
import {
  WORLD_ALTITUDE_TO_METERS,
  WORLD_SPEED_TO_METERS_PER_SECOND,
} from "./flight/units.js";
import {
  calculateDynamicLaunchZone,
  minimumStableShotSeconds,
  updateStableShotWindow,
} from "./ai/weapon-employment.js";
import {
  initialPilotPerception,
  selectPilotContact,
  updatePilotPerception,
  type PilotContact,
  type PilotObservation,
} from "./ai/perception.js";
import {
  initialPilotState,
  pilotControlError,
  pilotModelForSkill,
  stepPilotState,
} from "./ai/pilot-model.js";
import { planThreatResponse } from "./ai/threat-response.js";
import {
  initialMissionPlannerState,
  planAirMission,
} from "./ai/mission-planner.js";
import {
  planFormationTactics,
  type FormationContactObservation,
} from "./ai/formation-tactics.js";
import { formationSlot, updateFormationStatus } from "./formation";
import {
  airDamageDisposition,
  resolveAircraftHit,
  stepAircraftLossOfControl,
} from "./damage";
import { chooseAirWeapon } from "./launch-management";
import {
  advanceCountermeasurePrograms,
  queueCountermeasureProgram,
} from "./countermeasure-program";
import {
  defensiveManeuverFromWarning,
  missionShouldReturn,
  noContactMissionDirection,
  selectThrustMode,
  defensiveShotAllowed,
  selectMissionTrack,
  trackSupportsWeaponAuthorization,
} from "./ooda";
import { advanceAirTracks, createAirMeasurement } from "./track-store";
import {
  airToAirGuidancePoint,
  airToAirMidcourseAimPoint,
  airToAirMissilePhase,
  stepAirToAirPropulsion,
  shouldContinueAfterTargetLoss,
} from "./missile-runtime";
import { updateAntiShipGuidance } from "../anti-ship-guidance";
import { radarCountermeasureContest } from "../radar-countermeasures";
import {
  commitEngagementAuthorization,
  resolveEngagement,
} from "../defense/engagement.js";
import { opposingSides } from "../defense/allegiance.js";
import { Link16Network } from "../datalink/link16-network.js";
import { Link11Network } from "../datalink/link11-network.js";
import type { TacticalNetworkDecisionView, TacticalNetworkObservation, TacticalNetworkTrackView } from "../datalink/observability.js";
import type { Link16TrackReport } from "../datalink/types.js";
import { aircraftLink16Eligible, shipLink11Eligible, shipLink16Eligible } from "../datalink/era.js";
import { SovietGciNetwork } from "../soviet-c2/gci-network.js";
import { SovietMaritimeTargetingNetwork } from "../soviet-c2/maritime-targeting.js";
import { SovietFleetCommandNetwork } from "../soviet-c2/fleet-command.js";
import { SovietSalvoCoordinator } from "../soviet-c2/salvo-coordination.js";
import { SOVIET_GCI_CONTROLLER_POSITION } from "../soviet-c2/gci-network.js";
import type { SovietC2Observation } from "../soviet-c2/observability.js";
import { aewOrbitDirection, updateAewModelAnimation } from "./aew/mission.js";
import { AewCommandNetwork } from "./aew/command-network.js";
import {
  createDefenseTargetSource,
  DefenseTargetRegistry,
} from "../defense/target-source.js";
import type {
  AirCombatEvent,
  AirDecoyInstance,
  AirMissileInstance,
  AirPlatformInstance,
  AirScenarioContext,
  AirShipDefenseContact,
  AirSpawn,
  AirSubsystem,
  AirTrack,
  AirWeaponId,
} from "./types";

const UP = new THREE.Vector3(0, 1, 0);

interface PerceptionBindings {
  targetByTrackNumber: Map<string, string>;
  trackNumberByTarget: Map<string, string>;
  nextSerial: number;
}

interface FormationPerceptionBindings {
  targetByTrackNumber: Map<string, string>;
  trackNumberByTarget: Map<string, string>;
  nextSerial: number;
}

const initialPerceptionBindings = (): PerceptionBindings => ({
  targetByTrackNumber: new Map(),
  trackNumberByTarget: new Map(),
  nextSerial: 1,
});

function observationSource(track: AirTrack): PilotObservation["source"] {
  return track.source === "link11" || track.source === "link16"
    ? "tactical-network"
    : "organic-radar";
}

function perceptionObservation(
  track: AirTrack,
  bindings: PerceptionBindings,
): PilotObservation {
  let trackNumber = bindings.trackNumberByTarget.get(track.targetId);
  if (!trackNumber) {
    trackNumber = `P-${String(bindings.nextSerial++).padStart(4, "0")}`;
    bindings.trackNumberByTarget.set(track.targetId, trackNumber);
    bindings.targetByTrackNumber.set(trackNumber, track.targetId);
  }
  const networkCue = track.source === "link11" || track.source === "link16";
  return {
    trackNumber,
    estimatedPosition: track.position.clone(),
    estimatedVelocity: track.velocity.clone(),
    classification: track.classification,
    quality: track.quality,
    uncertainty: track.uncertainty,
    observedAt: track.lastUpdate,
    source: observationSource(track),
    weaponAuthorization: !networkCue && track.engagementQuality !== "cue",
  };
}

function contactAsRuntimeTrack(contact: PilotContact, targetId: string): AirTrack {
  return {
    targetId,
    position: contact.estimatedPosition.clone(),
    velocity: contact.estimatedVelocity.clone(),
    quality: contact.quality,
    uncertainty: contact.uncertainty,
    lastUpdate: contact.observedAt,
    classification: contact.classification,
    engagementQuality: contact.weaponAuthorization ? "weapon" : "cue",
  };
}
const clamp = THREE.MathUtils.clamp;
type AirRuntimeTarget = TargetableEntity | AirDecoyInstance;
const resultRangeFor = (
  missile: AirMissileInstance,
  target: TargetableEntity,
) => missile.position.distanceTo(target.position);
const angle = (a: THREE.Vector3, b: THREE.Vector3) =>
  THREE.MathUtils.radToDeg(a.angleTo(b));
function roll(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function tacticalTrackNumber(targetId: string) {
  let hash = 2166136261;
  for (const character of targetId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `T-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function rotateToward(
  current: THREE.Vector3,
  desired: THREE.Vector3,
  radians: number,
) {
  const delta = current.angleTo(desired);
  if (delta < 1e-5) return desired.clone();
  const axis = current.clone().cross(desired);
  if (axis.lengthSq() < 1e-6) axis.copy(UP);
  else axis.normalize();
  return current
    .clone()
    .applyAxisAngle(axis, Math.min(delta, radians))
    .normalize();
}

function instantiate(
  spawn: AirSpawn,
  serial: number,
  applyDamage: (id: string, damage: number, point: THREE.Vector3) => void,
): AirPlatformInstance {
  const model = spawn.definition.buildModel();
  model.position.copy(spawn.position);
  const remaining = new Map(
    Object.entries(spawn.definition.loadout) as [AirWeaponId, number][],
  );
  const hardpoints = spawn.definition.hardpoints.map((definition) => {
    const weaponId =
      definition.compatibleWeapons.find(
        (candidate) => (remaining.get(candidate) ?? 0) > 0,
      ) ?? null;
    const mountedModel = weaponId ? createAirWeaponModel(AIR_WEAPONS[weaponId]) : null;
    if (weaponId) remaining.set(weaponId, (remaining.get(weaponId) ?? 0) - 1);
    if (mountedModel) {
      mountedModel.position.set(...definition.position);
      mountedModel.scale.setScalar(0.72);
      const flame = mountedModel.userData.flame as THREE.Mesh | undefined;
      if (flame) flame.visible = false;
      model.add(mountedModel);
    }
    return {
      id: definition.id,
      position: new THREE.Vector3(...definition.position),
      compatibleWeapons: definition.compatibleWeapons,
      releaseDelay: definition.releaseDelay,
      ignitionDelay: definition.ignitionDelay,
      weaponId,
      mountedModel,
      state: weaponId ? ("ready" as const) : ("empty" as const),
      releaseAt: Infinity,
      targetId: null,
      commandPoint: new THREE.Vector3(),
      commandVelocity: new THREE.Vector3(),
      trackQuality: 0,
    };
  });
  const id = `${spawn.side}-${spawn.definition.id}-${serial}`;
  const pilotSkill = spawn.pilotSkill ?? "regular";
  const pilotModel = pilotModelForSkill(pilotSkill);
  return {
    id,
    side: spawn.side,
    kind: "aircraft",
    position: model.position,
    velocity: spawn.heading
      .clone()
      .normalize()
      .multiplyScalar(spawn.definition.flight.cruiseSpeed),
    radarCrossSection: spawn.definition.radarCrossSection,
    infraredSignature: spawn.definition.infraredSignature,
    alive: true,
    applyDamage: (damage, point) => applyDamage(id, damage, point),
    definition: spawn.definition,
    model,
    formationId: spawn.formationId,
    formationIndex: spawn.formationIndex,
    leaderId: spawn.leaderId ?? null,
    protectedId: null,
    mission: spawn.mission ?? spawn.definition.mission,
    fuel: spawn.definition.flight.fuelSeconds,
    thrustMode: "cruise",
    afterburnerRemaining: spawn.definition.flight.thrust.afterburnerSeconds,
    heading: spawn.heading.clone().normalize(),
    desiredDirection: spawn.heading.clone().normalize(),
    bank: 0,
    advancedFlightState: initialAdvancedFlightState(spawn.definition),
    tacticalState: initialAirTacticalState(),
    pilotPerception: initialPilotPerception(),
    pilotState: initialPilotState(pilotModel),
    pilotSkill,
    pilotModel,
    nextPilotUpdate: 0,
    missionPlanningState: initialMissionPlannerState({
      mission: spawn.mission ?? spawn.definition.mission,
      position: spawn.position,
    }),
    nextMissionPlanningUpdate: 0,
    nextPerceptionUpdate: 0,
    tracks: new Map(),
    networkTracks: new Map(),
    missileWarnings: new Map(),
    ammo: new Map(
      Object.entries(spawn.definition.loadout) as [AirWeaponId, number][],
    ),
    subsystemHealth: new Map<AirSubsystem, number>([
      ["structure", 100],
      ["left-engine", 100],
      ["right-engine", 100],
      ["radar", 100],
      ["flight-control", 100],
      ["weapons", 100],
    ]),
    nextOoda: 0,
    nextScan: 0,
    nextCountermeasure: 0,
    noContactSince: null,
    chaff: spawn.definition.countermeasures.chaff,
    flares: spawn.definition.countermeasures.flares,
    state: "formation",
    targetId: null,
    engagements: new Map(),
    hardpoints,
    countermeasurePrograms: [],
    formationStatus: spawn.formationIndex === 0 ? "joined" : "rejoining",
    formationError: 0,
  };
}

export class AirCombatSystem {
  onOceanSplash: ((position: THREE.Vector3, energy: number) => void) | null = null;
  onCountermeasureVisual: ((type: "chaff" | "flare", position: THREE.Vector3, velocity: THREE.Vector3) => void) | null = null;
  readonly group = new THREE.Group();
  readonly aircraft: AirPlatformInstance[] = [];
  readonly missiles: AirMissileInstance[] = [];
  readonly decoys: AirDecoyInstance[] = [];
  readonly events: AirCombatEvent[] = [];
  enabled = true;
  countermeasuresEnabled = true;
  private serial = 0;
  private lastEventIndex = 0;
  private currentTime = 0;
  private activeAdvancedAirAi = false;
  private readonly perceptionBindings = new Map<string, PerceptionBindings>();
  private readonly formationPerceptionBindings =
    new Map<string, FormationPerceptionBindings>();
  private nextFormationTacticsUpdate = 0;
  private standardDamageApplications = 0;
  private readonly link16 = new Link16Network();
  private readonly link11 = new Link11Network();
  private readonly aewCommandNetwork = new AewCommandNetwork();
  private readonly seenAewCommands = new Set<string>();
  private readonly sovietGci = new SovietGciNetwork();
  private readonly seenGciCommands = new Set<string>();
  private readonly sovietMaritimeTargeting = new SovietMaritimeTargetingNetwork();
  private readonly seenMaritimeCues = new Set<string>();
  private readonly radarStandbyParticipants = new Set<string>();
  private readonly sovietFleetCommand = new SovietFleetCommandNetwork();
  private readonly seenFleetOrders = new Set<string>();
  private readonly sovietSalvoCoordinator = new SovietSalvoCoordinator();
  private readonly seenSalvoPlans = new Set<string>();
  private sovietCommandEra: AirScenarioContext["sovietCommandEra"] = "ntu-1980s";
  private sovietCommandEnabled = true;
  private readonly externalLink16Published = new Map<string, number>();
  private readonly externalLink16Cues = new Map<string, AirTrack[]>();
  private readonly activeLink16ParticipantIds = new Set<string>();
  private readonly activeLink11ParticipantIds = new Set<string>();
  private readonly externalLink11Published = new Map<string, number>();
  private readonly externalLink11Cues = new Map<string, AirTrack[]>();
  private datalinkConfigurationKey: string | null = null;
  private readonly tacticalNetworkDecisions: TacticalNetworkDecisionView[] = [];
  private readonly tacticalNetworkDecisionKeys = new Set<string>();
  private tacticalNetworkDecisionSerial = 0;
  private readonly targetSources =
    new DefenseTargetRegistry<AirRuntimeTarget>();
  private externalTargets: readonly TargetableEntity[] = [];
  constructor(private scene: THREE.Scene) {
    this.targetSources.register(
      createDefenseTargetSource("aircraft", () =>
        this.aircraft
          .filter((target) => target.alive)
          .map((target) => [target.id, target] as const),
      ),
    );
    this.targetSources.register(
      createDefenseTargetSource("air-weapons", () =>
        this.missiles
          .filter((target) => target.alive)
          .map((target) => [target.id, target] as const),
      ),
    );
    this.targetSources.register(
      createDefenseTargetSource("air-decoys", () =>
        this.decoys
          .filter((target) => target.alive)
          .map((target) => [target.id, target] as const),
      ),
    );
    this.targetSources.register(
      createDefenseTargetSource("external-combat-entities", () =>
        this.externalTargets
          .filter((target) => target.alive)
          .map((target) => [target.id, target] as const),
      ),
    );
    this.group.name = "air-combat";
    scene.add(this.group);
  }
  reset(
    blueShip: CombatEntity,
    redShip: CombatEntity | null,
    spawns: readonly AirSpawn[],
  ) {
    this.disposeObjects();
    this.serial = 0;
    this.standardDamageApplications = 0;
    this.perceptionBindings.clear();
    this.formationPerceptionBindings.clear();
    this.nextFormationTacticsUpdate = 0;
    this.link16.reset();
    this.link11.reset();
    this.aewCommandNetwork.reset();
    this.seenAewCommands.clear();
    this.sovietGci.reset();
    this.seenGciCommands.clear();
    this.sovietMaritimeTargeting.reset();
    this.seenMaritimeCues.clear();
    this.radarStandbyParticipants.clear();
    this.sovietFleetCommand.reset();
    this.seenFleetOrders.clear();
    this.sovietSalvoCoordinator.reset();
    this.seenSalvoPlans.clear();
    this.externalLink16Published.clear();
    this.externalLink16Cues.clear();
    this.activeLink16ParticipantIds.clear();
    this.activeLink11ParticipantIds.clear();
    this.externalLink11Published.clear();
    this.externalLink11Cues.clear();
    this.datalinkConfigurationKey = null;
    this.tacticalNetworkDecisions.length = 0;
    this.tacticalNetworkDecisionKeys.clear();
    this.tacticalNetworkDecisionSerial = 0;
    const protectedFormations = new Map<string, string>();
    for (const spawn of spawns) {
      const p = instantiate(spawn, ++this.serial, (id, damage, point) => {
        const target = this.aircraft.find(
          (candidate) => candidate.id === id && candidate.alive,
        );
        if (target)
          this.applyAircraftDamage(target, damage, point, this.currentTime);
      });
      if (spawn.protectedFormationId)
        protectedFormations.set(p.id, spawn.protectedFormationId);
      this.aircraft.push(p);
      this.perceptionBindings.set(p.id, initialPerceptionBindings());
      this.group.add(p.model);
    }
    for (const p of this.aircraft) {
      if (p.formationIndex > 0) {
        const leader = this.aircraft.find(
          (x) => x.formationId === p.formationId && x.formationIndex === 0,
        );
        p.leaderId = leader?.id ?? null;
      }
    }
    for (const [escortId, protectedFormationId] of protectedFormations) {
      const escort = this.aircraft.find((aircraft) => aircraft.id === escortId),
        protectedLeader = this.aircraft.find(
          (aircraft) =>
            aircraft.formationId === protectedFormationId &&
            aircraft.formationIndex === 0,
        );
      if (escort && protectedLeader) {
        escort.protectedId = protectedLeader.id;
        escort.leaderId = protectedLeader.id;
      }
    }
    this.group.userData.context = { blueShip, redShip };
  }
  private disposeObjects() {
    for (const o of [
      ...this.aircraft.map((x) => x.model),
      ...this.missiles.map((x) => x.model),
      ...this.decoys.map((x) => x.model),
    ]) {
      this.group.remove(o);
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          const m = c.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }
    this.aircraft.length =
      this.missiles.length =
      this.decoys.length =
      this.events.length =
        0;
    this.lastEventIndex = 0;
  }
  dispose() {
    this.disposeObjects();
    this.scene.remove(this.group);
  }
  private emit(time: number, kind: AirCombatEvent["kind"], text: string) {
    this.events.push({ time, kind, text });
  }
  drainEvents() {
    const out = this.events.slice(this.lastEventIndex);
    this.lastEventIndex = this.events.length;
    return out;
  }
  private entities(context: AirScenarioContext) {
    this.externalTargets = context.targets ?? [
      context.blueShip,
      ...(context.redShip ? [context.redShip] : []),
    ];
    return this.targetSources.values();
  }
  update(time: number, dt: number, context: AirScenarioContext) {
    if (!this.enabled) return;
    this.currentTime = time;
    this.activeAdvancedAirAi = context.advancedAirAiEnabled ?? false;
    this.group.userData.context = context;
    const datalinkEra = context.datalinkEra ?? "link16-modernized",
      datalinkEnabled = context.datalinkEnabled ?? context.link16Enabled ?? true,
      link16Enabled = datalinkEnabled && (context.link16Enabled ?? true);
    this.sovietCommandEra = context.sovietCommandEra ?? "ntu-1980s";
    this.sovietCommandEnabled = context.sovietCommandEnabled ?? true;
    this.sovietGci.configure(this.sovietCommandEra, this.sovietCommandEnabled);
    this.sovietMaritimeTargeting.configure(
      this.sovietCommandEra,
      this.sovietCommandEnabled,
    );
    this.sovietFleetCommand.configure(
      this.sovietCommandEra,
      this.sovietCommandEnabled,
    );
    const datalinkConfigurationKey = `${datalinkEra}:${datalinkEnabled}:${link16Enabled}`;
    if (this.datalinkConfigurationKey !== datalinkConfigurationKey) {
      this.link16.reset();
      this.link11.reset();
      this.externalLink16Published.clear();
      this.externalLink16Cues.clear();
      this.externalLink11Published.clear();
      this.externalLink11Cues.clear();
      for (const aircraft of this.aircraft) aircraft.networkTracks.clear();
      this.datalinkConfigurationKey = datalinkConfigurationKey;
    }
    this.activeLink16ParticipantIds.clear();
    this.activeLink11ParticipantIds.clear();
    const tacticalParticipants = context.tacticalNetworkParticipants ??
      context.link16Participants ?? [];
    for (const aircraft of this.aircraft) {
      const terminal = aircraft.definition.datalink;
      if (terminal?.link16 && aircraftLink16Eligible({
          era: datalinkEra,
          enabled: link16Enabled,
          minimumEra: terminal.minimumEra!,
        })) {
        this.activeLink16ParticipantIds.add(aircraft.id);
        this.link16.upsertParticipant({id:aircraft.id,side:aircraft.side,position:aircraft.position,alive:aircraft.alive,
          terminalHealth:terminal.terminalReliability*Math.min((aircraft.subsystemHealth.get("radar")??0)/100,(aircraft.subsystemHealth.get("weapons")??0)/100),
          timeSyncQuality:terminal.timeSyncQuality,transmitEnabled:aircraft.alive,receiveEnabled:aircraft.alive});
      }
      if(terminal?.link11&&shipLink11Eligible({era:datalinkEra,enabled:datalinkEnabled})){
        this.activeLink11ParticipantIds.add(aircraft.id);
        this.link11.upsertParticipant({id:aircraft.id,side:aircraft.side,position:aircraft.position,alive:aircraft.alive,
          terminalHealth:terminal.terminalReliability*((aircraft.subsystemHealth.get("radar")??0)/100),timeSyncQuality:terminal.timeSyncQuality,
          transmitEnabled:aircraft.alive,receiveEnabled:aircraft.alive,netControlCapable:terminal.link11NetControlCapable??false});
      }
    }
    for (const participant of tacticalParticipants) {
      if (shipLink11Eligible({ era: datalinkEra, enabled: datalinkEnabled })) {
        this.activeLink11ParticipantIds.add(participant.entity.id);
        this.link11.upsertParticipant({
          id:participant.entity.id, side:participant.entity.side,
          position:participant.entity.position, alive:participant.entity.alive,
          terminalHealth:participant.terminalHealth, timeSyncQuality:.72,
          transmitEnabled:participant.entity.alive, receiveEnabled:participant.entity.alive,
          netControlCapable:true,
        });
      }
      if (!shipLink16Eligible({ era: datalinkEra, enabled: link16Enabled }))
        { /* Link 11 may still use this participant below. */ }
      else {
        this.activeLink16ParticipantIds.add(participant.entity.id);
        this.link16.upsertParticipant({
        id: participant.entity.id,
        side: participant.entity.side,
        position: participant.entity.position,
        alive: participant.entity.alive,
        terminalHealth: participant.terminalHealth,
        timeSyncQuality: participant.timeSyncQuality,
        transmitEnabled: participant.entity.alive,
        receiveEnabled: participant.entity.alive,
        });
      }
      for (const track of participant.reports) {
        const cue = [
          ...(this.externalLink11Cues.get(participant.entity.id) ?? []),
          ...(this.externalLink16Cues.get(participant.entity.id) ?? []),
        ].find((candidate) =>
          candidate.classification === track.classification &&
          candidate.position.distanceTo(track.position) <=
            Math.max(12, candidate.uncertainty + track.uncertainty));
        if (cue?.source === "link11" || cue?.source === "link16")
          this.recordTacticalNetworkDecision({
            network: cue.source,
            kind: "organic-acquisition",
            time,
            participantId: participant.entity.id,
            trackId: cue.targetId,
            organicTargetId: track.targetId,
          });
        const observationId =
          track.observationId ??
          `${participant.entity.id}:${track.targetId}:${track.lastUpdate.toFixed(3)}`;
        const publishKey = `${participant.entity.id}:${observationId}`;
        const report = {
          trackId: tacticalTrackNumber(track.targetId),
          originSensorId: track.originSensorId ?? `${participant.entity.id}:sensor`,
          observationId,
          relayChain: [],
          observedAt: track.lastUpdate,
          position: track.position,
          velocity: track.velocity,
          classification: track.classification,
          quality: track.quality,
          uncertainty: track.uncertainty,
          priority: track.classification === "unknown" ? "threat" : "routine",
        } as const;
        if (this.activeLink11ParticipantIds.has(participant.entity.id) &&
          !this.externalLink11Published.has(publishKey)) {
          this.externalLink11Published.set(publishKey,time);
          this.link11.publishTrack(participant.entity.id,report,time);
        }
        if (this.activeLink16ParticipantIds.has(participant.entity.id) &&
          !this.externalLink16Published.has(publishKey)) {
          this.externalLink16Published.set(publishKey,time);
          this.link16.publishTrack(participant.entity.id,report,time);
        }
      }
    }
    for (const [key,publishedAt] of this.externalLink11Published)
      if(time-publishedAt>30)this.externalLink11Published.delete(key);
    for (const [key, publishedAt] of this.externalLink16Published)
      if (time - publishedAt > 20) this.externalLink16Published.delete(key);
    this.link16.update(time);
    this.link11.update(time);
    for (const aircraft of this.aircraft)
      if (this.activeLink16ParticipantIds.has(aircraft.id))
        this.receiveLink16Tracks(aircraft, time);
    for (const participant of tacticalParticipants) {
      if (!this.activeLink16ParticipantIds.has(participant.entity.id)) continue;
      const cues = this.link16.drainInbox(participant.entity.id)
        .filter((delivery) => time - delivery.report.observedAt <= 8)
        .map((delivery): AirTrack => {
          const report = delivery.report,
            age = Math.max(0, time - report.observedAt);
          return {
            targetId: `link16:${report.trackId}`,
            position: report.position.clone().addScaledVector(report.velocity, age),
            velocity: report.velocity.clone(),
            quality: clamp(report.quality * 0.85 - age * 0.018, 0.03, 0.82),
            uncertainty: report.uncertainty + 8 + age * 1.4,
            lastUpdate: report.observedAt,
            classification: (
              report.classification === "aircraft" || report.classification === "ship"
                ? report.classification
                : "unknown") as AirTrack["classification"],
            source: "link16" as const,
            engagementQuality: "cue" as const,
            originSensorId: report.originSensorId,
            observationId: report.observationId,
            senderId: report.senderId,
            receivedAt: delivery.receivedAt,
          };
        });
      if (cues.length) this.externalLink16Cues.set(participant.entity.id, cues);
    }
    for (const participant of tacticalParticipants) {
      if(!this.activeLink11ParticipantIds.has(participant.entity.id))continue;
      const cues=this.link11.drainInbox(participant.entity.id)
        .filter(delivery=>time-delivery.report.observedAt<=24)
        .map((delivery):AirTrack=>{
          const report=delivery.report, age=Math.max(0,time-report.observedAt);
          return {targetId:`link11:${report.trackId}`,
            position:report.position.clone().addScaledVector(report.velocity,age),
            velocity:report.velocity.clone(),quality:clamp(report.quality*.68-age*.025,.03,.58),
            uncertainty:report.uncertainty+20+age*2.8,lastUpdate:report.observedAt,
            classification:(report.classification==="aircraft"||report.classification==="ship"?report.classification:"unknown") as AirTrack["classification"],
            source:"link11",engagementQuality:"cue",originSensorId:report.originSensorId,
            observationId:report.observationId,senderId:report.senderId,receivedAt:delivery.receivedAt};
        });
      if(cues.length)this.externalLink11Cues.set(participant.entity.id,cues);
    }
    this.pruneExternalCues(time);
    this.sovietGci.update(
      time,
      this.aircraft
        .filter((aircraft) => aircraft.side === "red" && aircraft.formationIndex === 0)
        .map((aircraft) => ({
          id: aircraft.id,
          platformId: aircraft.definition.id,
          position: aircraft.position,
          velocity: aircraft.velocity,
          alive: aircraft.alive,
        })),
      this.aircraft
        .filter((aircraft) => aircraft.side === "blue")
        .map((aircraft) => ({
          id: aircraft.id,
          position: aircraft.position,
          velocity: aircraft.velocity,
          radarCrossSection: aircraft.radarCrossSection,
          alive: aircraft.alive,
        })),
    );
    this.aewCommandNetwork.update(
      time,
      this.aircraft.flatMap(aircraft=>{
        const command=aircraft.definition.aewCommand;
        return command&&aircraft.mission==="aew"?[{id:aircraft.id,side:aircraft.side,position:aircraft.position,velocity:aircraft.velocity,alive:aircraft.alive,mode:command.mode,controllerCapacity:command.controllerCapacity,commandDelay:command.commandDelay,commandLife:command.commandLife,reliability:command.reliability,fighterPlatformIds:command.fighterPlatformIds,tracks:[...aircraft.tracks.values()]}]:[];
      }),
      this.aircraft.map(aircraft=>({id:aircraft.id,side:aircraft.side,platformId:aircraft.definition.id,position:aircraft.position,alive:aircraft.alive})),
    );
    for(const command of this.aewCommandNetwork.active(time)){
      if(this.seenAewCommands.has(command.id))continue;
      this.seenAewCommands.add(command.id);
      const participant=this.aircraft.find(aircraft=>aircraft.id===command.participantId);
      this.emit(time,"guidance",`${participant?.definition.name??command.participantId} AEW COMMAND RECEIVED / ${command.controllerTrackId} / ${command.mode.toUpperCase()} / Q ${Math.round(command.quality*100)}% / CUE ONLY / NO WEAPON AUTHORITY`);
    }
    for (const aircraft of this.aircraft) {
      const command = this.sovietGci.commandFor(aircraft.id, time);
      if (!command || this.seenGciCommands.has(command.id)) continue;
      this.seenGciCommands.add(command.id);
      this.emit(
        time,
        "guidance",
        `${aircraft.definition.name} GCI COMMAND RECEIVED / ${command.controllerTrackId} / ${command.commandMode.toUpperCase()} / Q ${Math.round(command.quality * 100)}% / ALT ${Math.round(command.commandedAltitude * 50)}M / SPD ${Math.round(command.commandedSpeed * 360)}KMH / RADAR ${Math.round(command.radarActivationRange * 100)}M / VALID ${(command.expiresAt - time).toFixed(1)}S`,
      );
    }
    this.sovietMaritimeTargeting.update(
      time,
      this.aircraft
        .filter((aircraft) => aircraft.side === "red" && aircraft.formationIndex === 0)
        .map((aircraft) => ({
          id: aircraft.id,
          platformId: aircraft.definition.id,
          position: aircraft.position,
          alive: aircraft.alive,
        })),
      (context.targets ?? [context.blueShip])
        .filter((target) => target.side === "blue" && target.kind === "ship")
        .map((target) => ({
          id: target.id,
          position: target.position,
          velocity: target.velocity,
          radarCrossSection: target.radarCrossSection,
          alive: target.alive,
        })),
    );
    for (const aircraft of this.aircraft) {
      const cue = this.sovietMaritimeTargeting.cueFor(aircraft.id, time);
      if (!cue || this.seenMaritimeCues.has(cue.id)) continue;
      this.seenMaritimeCues.add(cue.id);
      this.emit(
        time,
        "guidance",
        `${aircraft.definition.name} ${cue.source.toUpperCase()} TARGET AREA RECEIVED / ${cue.reportTrackId} / Q ${Math.round(cue.quality * 100)}% / ERROR ${Math.round(cue.uncertaintyMajor)}x${Math.round(cue.uncertaintyMinor)} / CUE ONLY`,
      );
    }
    const fleetParticipants = this.aircraft
      .filter((aircraft) => aircraft.side === "red" && aircraft.formationIndex === 0)
      .map((aircraft) => ({
        id: aircraft.id,
        platformId: aircraft.definition.id,
        position: aircraft.position,
        alive: aircraft.alive,
      }));
    const fleetTargetAreas = new Map(fleetParticipants.flatMap((participant) => {
      const cue = this.sovietMaritimeTargeting.cueFor(participant.id, time);
      return cue ? [[participant.id, {
        reportTrackId: cue.reportTrackId,
        estimatedPosition: cue.estimatedPosition,
        launchRegionCenter: cue.launchRegionCenter,
        quality: cue.quality,
        observedAt: cue.observedAt,
        expiresAt: cue.expiresAt,
      }] as const] : [];
    }));
    this.sovietFleetCommand.update(
      time,
      context.redShip
        ? {
            id: context.redShip.id,
            label: "SURFACE FLAG RELAY",
            alive: context.redShip.alive,
            health: context.redShip.alive ? 1 : 0,
          }
        : {
            id: "soviet-fleet-command-post",
            label: "FLEET COMMAND POST",
            alive: true,
            health: 1,
          },
      fleetParticipants,
      fleetTargetAreas,
    );
    for (const aircraft of this.aircraft) {
      const order = this.sovietFleetCommand.orderFor(aircraft.id, time);
      if (!order || this.seenFleetOrders.has(order.id)) continue;
      this.seenFleetOrders.add(order.id);
      this.emit(
        time,
        "guidance",
        `${aircraft.definition.name} FLEET STRIKE ORDER RECEIVED / ${order.id} / SOURCE ${order.sourceReportTrackId} / ATTACK ${order.attackWindowStart.toFixed(1)}-${order.attackWindowEnd.toFixed(1)} / NO WEAPON AUTHORITY`,
      );
    }
    for (const leader of this.aircraft.filter((aircraft) =>
      aircraft.side === "red" && aircraft.definition.id === "TU-16K" && aircraft.formationIndex === 0)) {
      const order = this.sovietFleetCommand.orderFor(leader.id, time);
      const cue = this.sovietMaritimeTargeting.cueFor(leader.id, time);
      this.sovietSalvoCoordinator.update({
        time,
        order,
        participants: this.aircraft
          .filter((aircraft) => aircraft.formationId === leader.formationId && aircraft.definition.id === "TU-16K")
          .map((aircraft) => ({
            id: aircraft.id,
            formationId: aircraft.formationId,
            position: aircraft.position,
            alive: aircraft.alive,
            weaponReady: (aircraft.ammo.get("KSR-5") ?? 0) > 0 &&
              aircraft.hardpoints.some((hardpoint) => hardpoint.weaponId === "KSR-5" && hardpoint.state === "ready"),
          })),
        targetArea: cue ? {
          reportTrackId: cue.reportTrackId,
          estimatedPosition: cue.estimatedPosition,
        } : undefined,
        weaponSpeed: AIR_WEAPONS["KSR-5"].speed,
      });
    }
    for (const aircraft of this.aircraft) {
      const plan = this.sovietSalvoCoordinator.planFor(aircraft.id, time);
      if (!plan || this.seenSalvoPlans.has(plan.id)) continue;
      this.seenSalvoPlans.add(plan.id);
      this.emit(
        time,
        "guidance",
        `${aircraft.definition.name} SALVO ASSIGNMENT / AIRFRAME ${aircraft.id} / ${plan.waveId} / ROUND ${plan.sequence}/${plan.total} / RELEASE ${plan.releaseAt.toFixed(1)} / ARRIVAL ${plan.plannedArrivalAt.toFixed(1)} / SOURCE ${plan.sourceReportTrackId}`,
      );
    }
    this.updateDecoys(dt);
    this.updateCountermeasurePrograms(time);
    if (this.activeAdvancedAirAi && time >= this.nextFormationTacticsUpdate) {
      this.updateFormationTactics(time);
      this.nextFormationTacticsUpdate = time + 0.75;
    }
    for (const a of this.aircraft) {
      this.updateFormationState(a);
      this.updateAircraft(a, time, dt, context);
      this.updateFlightVisuals(a, time, dt);
      this.updateDamageVisuals(a, time);
    }
    this.updateHardpointReleases(time);
    for (const m of this.missiles) this.updateMissile(m, time, dt, context);
  }

  private updateFormationTactics(_time: number) {
    const formationIds = new Set(
      this.aircraft.filter((aircraft) => aircraft.alive)
        .map((aircraft) => aircraft.formationId),
    );
    for (const formationId of formationIds) {
      const members = this.aircraft
        .filter((aircraft) => aircraft.formationId === formationId)
        .sort((left, right) => left.formationIndex - right.formationIndex);
      const assignedClassification = members.some((member) =>
        member.mission === "anti-ship") ? "ship" : "aircraft";
      let bindings = this.formationPerceptionBindings.get(formationId);
      if (!bindings) {
        bindings = {
          targetByTrackNumber: new Map(),
          trackNumberByTarget: new Map(),
          nextSerial: 1,
        };
        this.formationPerceptionBindings.set(formationId, bindings);
      }
      const contactsByNumber = new Map<string, FormationContactObservation>();
      for (const member of members) {
        const pilotBindings = this.perceptionBindings.get(member.id);
        if (!pilotBindings) continue;
        for (const contact of member.pilotPerception.contacts.values()) {
          if (contact.classification !== assignedClassification ||
              contact.source === "memory")
            continue;
          const targetId = pilotBindings.targetByTrackNumber.get(contact.trackNumber);
          if (!targetId) continue;
          let formationTrack = bindings.trackNumberByTarget.get(targetId);
          if (!formationTrack) {
            formationTrack = `F-${String(bindings.nextSerial++).padStart(4, "0")}`;
            bindings.trackNumberByTarget.set(targetId, formationTrack);
            bindings.targetByTrackNumber.set(formationTrack, targetId);
          }
          const previous = contactsByNumber.get(formationTrack);
          const candidate = {
            trackNumber: formationTrack,
            quality: contact.quality,
            uncertainty: contact.uncertainty,
            threat: Math.max(0.1, contact.quality *
              (1 - Math.min(0.8, contact.uncertainty / 100))),
            observerSlots: [member.formationIndex],
          };
          if (!previous || candidate.quality > previous.quality)
            contactsByNumber.set(formationTrack, {
              ...candidate,
              observerSlots: [...new Set([
                ...(previous?.observerSlots ?? []),
                member.formationIndex,
              ])],
            });
          else if (!previous.observerSlots.includes(member.formationIndex))
            contactsByNumber.set(formationTrack, {
              ...previous,
              observerSlots: [...previous.observerSlots, member.formationIndex],
            });
        }
      }
      const plan = planFormationTactics({
        members: members.map((member) => {
          const supportedWeapon = this.missiles.find((missile) =>
            missile.alive && missile.shooterId === member.id &&
            (!missile.seekerAcquired ||
              missile.definition.guidance === "semi-active-radar"));
          return {
            slot: member.formationIndex,
            alive: member.alive,
            threatened: member.missileWarnings.size > 0 ||
              member.state === "defending",
            joined: member.formationIndex === 0 ||
              member.formationStatus === "joined",
            weaponReady: [...member.ammo.values()].some((count) => count > 0) &&
              (member.subsystemHealth.get("weapons") ?? 0) > 20,
            supportingWeapon: Boolean(supportedWeapon),
            supportedTrackNumber: supportedWeapon
              ? bindings.trackNumberByTarget.get(supportedWeapon.targetId) ?? null
              : null,
            visibleTrackNumbers: [...contactsByNumber.values()]
              .filter((contact) =>
                contact.observerSlots.includes(member.formationIndex))
              .map((contact) => contact.trackNumber),
          };
        }),
        contacts: [...contactsByNumber.values()],
        allowCoordinatedSalvo: members.some((member) =>
          member.mission === "anti-ship"),
      });
      for (const assignment of plan.assignments) {
        const member = members.find((candidate) =>
          candidate.formationIndex === assignment.slot);
        if (!member) continue;
        member.tacticalState.formationRole = assignment.role;
        member.tacticalState.formationCommandSlot = assignment.commandSlot;
        member.tacticalState.formationTrackNumber = assignment.assignedTrackNumber;
        const commander = members.find((candidate) =>
          candidate.formationIndex === assignment.commandSlot && candidate.alive);
        if (member.formationIndex !== assignment.commandSlot && commander)
          member.leaderId = commander.id;
      }
    }
  }

  private receiveLink16Tracks(aircraft: AirPlatformInstance, time: number) {
    const previous = new Map(aircraft.networkTracks);
    advanceAirTracks(aircraft.networkTracks, 0, time);
    for (const [id, track] of previous)
      if (!aircraft.networkTracks.has(id))
        this.recordTacticalNetworkDecision({
          network: track.source === "link11" ? "link11" : "link16",
          kind: "cue-expired",
          time,
          participantId: aircraft.id,
          trackId: id,
        });
    for (const delivery of this.link16.drainInbox(aircraft.id)) {
      const report = delivery.report;
      if (time - report.observedAt > 8 || report.side !== aircraft.side) continue;
      const age = Math.max(0, time - report.observedAt),
        quality = clamp(report.quality * 0.85 - age * 0.018, 0.03, 0.82),
        uncertainty = report.uncertainty + 8 + age * 1.4,
        networkTrackId = `link16:${report.trackId}`,
        existing = aircraft.networkTracks.get(networkTrackId);
      if (existing && existing.quality > quality && existing.lastUpdate >= report.observedAt)
        continue;
      aircraft.networkTracks.set(networkTrackId, {
        targetId: networkTrackId,
        position: report.position.clone().addScaledVector(report.velocity, age),
        velocity: report.velocity.clone(),
        quality,
        uncertainty,
        lastUpdate: report.observedAt,
        classification:
          report.classification === "aircraft" || report.classification === "ship"
            ? report.classification
            : "unknown",
        source: "link16",
        engagementQuality: "cue",
        originSensorId: report.originSensorId,
        observationId: report.observationId,
        senderId: report.senderId,
        receivedAt: delivery.receivedAt,
      });
    }
  }

  link16Diagnostics() {
    return this.link16.diagnostics();
  }

  link11Diagnostics() { return this.link11.diagnostics(); }

  damageManagementDiagnostics() {
    if (!this.activeAdvancedAirAi) return [];
    return this.aircraft.map((aircraft) => {
      const plan = planDamageFlight({
        mission: aircraft.mission,
        maximumLoadFactor: aircraft.definition.flight.maxLoadFactor,
        structureHealth: aircraft.subsystemHealth.get("structure") ?? 0,
        leftEngineHealth: aircraft.subsystemHealth.get("left-engine") ?? 0,
        rightEngineHealth: aircraft.subsystemHealth.get("right-engine") ?? 0,
        radarHealth: aircraft.subsystemHealth.get("radar") ?? 0,
        flightControlHealth: aircraft.subsystemHealth.get("flight-control") ?? 0,
        weaponSystemHealth: aircraft.subsystemHealth.get("weapons") ?? 0,
        alternativeCloseWeaponAvailable: [...aircraft.ammo.entries()].some(
          ([weaponId, count]) => count > 0 &&
            AIR_WEAPONS[weaponId].guidance === "infrared",
        ),
      });
      return { aircraftId: aircraft.id, ...plan };
    });
  }

  sovietGciDiagnostics(time = this.currentTime) {
    return this.sovietGci.diagnostics(time);
  }

  gciCommandFor(participantId: string, time = this.currentTime) {
    return this.sovietGci.commandFor(participantId, time);
  }

  sovietMaritimeTargetingDiagnostics(time = this.currentTime) {
    return this.sovietMaritimeTargeting.diagnostics(time);
  }

  maritimeTargetAreaCueFor(participantId: string, time = this.currentTime) {
    return this.sovietMaritimeTargeting.cueFor(participantId, time);
  }

  sovietRadarStandbyParticipants() {
    return [...this.radarStandbyParticipants];
  }

  sovietFleetCommandDiagnostics(time = this.currentTime) {
    return this.sovietFleetCommand.diagnostics(time);
  }

  sovietFleetOrderFor(participantId: string, time = this.currentTime) {
    return this.sovietFleetCommand.orderFor(participantId, time);
  }

  sovietSalvoDiagnostics(time = this.currentTime) {
    return this.sovietSalvoCoordinator.diagnostics(time);
  }

  sovietSalvoPlanFor(participantId: string, time = this.currentTime) {
    return this.sovietSalvoCoordinator.planFor(participantId, time);
  }

  sovietC2Observation(time = this.currentTime): SovietC2Observation {
    const context = this.group.userData.context as AirScenarioContext | undefined;
    const fleet = this.sovietFleetCommand.diagnostics(time);
    const fleetPosition = context?.redShip?.position.clone() ??
      new THREE.Vector3(420, 14, -940);
    const nodes = [
      {
        id: "soviet-gci-sector-1",
        kind: "gci-controller" as const,
        label: this.sovietGci.diagnostics(time).controller,
        position: SOVIET_GCI_CONTROLLER_POSITION.clone(),
        operational: this.sovietGci.diagnostics(time).enabled,
      },
      {
        id: fleet.nodeId,
        kind: "fleet-command" as const,
        label: fleet.nodeLabel,
        position: fleetPosition,
        operational: fleet.enabled && fleet.nodeAlive,
      },
    ];
    const gciCommands = this.aircraft.flatMap((aircraft) => {
      const command = this.sovietGci.commandFor(aircraft.id, time);
      return command ? [{
        id: command.id,
        participantId: aircraft.id,
        participantPosition: aircraft.position.clone(),
        controllerTrackId: command.controllerTrackId,
        interceptPoint: command.interceptPoint.clone(),
        quality: command.quality,
        uncertainty: command.uncertainty,
        commandedSpeed: command.commandedSpeed,
        radarActivationRange: command.radarActivationRange,
        commandMode: command.commandMode,
        deliveredAt: command.deliveredAt,
        expiresAt: command.expiresAt,
      }] : [];
    });
    const maritimeAreas = this.aircraft.flatMap((aircraft) => {
      const cue = this.sovietMaritimeTargeting.cueFor(aircraft.id, time);
      return cue ? [{
        id: cue.id,
        participantId: aircraft.id,
        reportTrackId: cue.reportTrackId,
        source: cue.source,
        estimatedPosition: cue.estimatedPosition.clone(),
        launchRegionCenter: cue.launchRegionCenter.clone(),
        uncertaintyMajor: cue.uncertaintyMajor,
        uncertaintyMinor: cue.uncertaintyMinor,
        uncertaintyBearing: cue.uncertaintyBearing,
        quality: cue.quality,
        deliveredAt: cue.deliveredAt,
        expiresAt: cue.expiresAt,
      }] : [];
    });
    const fleetOrders = this.aircraft.flatMap((aircraft) => {
      const order = this.sovietFleetCommand.orderFor(aircraft.id, time);
      return order ? [{
        id: order.id,
        participantId: aircraft.id,
        participantPosition: aircraft.position.clone(),
        commandNodeId: order.commandNodeId,
        sourceReportTrackId: order.sourceReportTrackId,
        approachPoint: order.approachPoint.clone(),
        attackWindowStart: order.attackWindowStart,
        attackWindowEnd: order.attackWindowEnd,
        deliveredAt: order.deliveredAt,
        expiresAt: order.expiresAt,
      }] : [];
    });
    const salvoAssignments = this.aircraft.flatMap((aircraft) => {
      const plan = this.sovietSalvoCoordinator.planFor(aircraft.id, time);
      return plan ? [{
        id: plan.id,
        waveId: plan.waveId,
        participantId: aircraft.id,
        participantPosition: aircraft.position.clone(),
        sourceOrderId: plan.sourceOrderId,
        sourceReportTrackId: plan.sourceReportTrackId,
        sequence: plan.sequence,
        total: plan.total,
        releaseAt: plan.releaseAt,
        plannedArrivalAt: plan.plannedArrivalAt,
        expiresAt: plan.expiresAt,
      }] : [];
    });
    return {
      era: this.sovietCommandEra ?? "ntu-1980s",
      enabled: this.sovietCommandEnabled,
      nodes,
      gciCommands,
      maritimeAreas,
      fleetOrders,
      salvoAssignments,
      events: this.events.flatMap((event, index) => {
        const layer = event.text.includes("GCI COMMAND") ? "gci" as const
          : event.text.includes("TARGET AREA RECEIVED") ? "maritime" as const
          : event.text.includes("FLEET STRIKE ORDER") ? "fleet-command" as const
          : event.text.includes("SALVO ASSIGNMENT") ? "salvo" as const
          : undefined;
        return layer ? [{ id: `soviet-c2-event-${index}`, time: event.time, layer, text: event.text }] : [];
      }),
    };
  }

  private fleetOrderForAircraft(a: AirPlatformInstance, time: number) {
    return this.sovietFleetCommand.orderFor(a.id, time) ??
      (a.leaderId ? this.sovietFleetCommand.orderFor(a.leaderId, time) : undefined);
  }

  private strikeCommandAllowsRelease(a: AirPlatformInstance, time: number) {
    if (a.side !== "red" || a.mission !== "anti-ship") return true;
    if (!this.sovietFleetCommand.diagnostics(time).enabled) return true;
    const order = this.fleetOrderForAircraft(a, time);
    if (!order) return time >= 15;
    const plan = this.sovietSalvoCoordinator.planFor(a.id, time);
    if (!plan) return false;
    return time >= plan.releaseAt && time <= order.attackWindowEnd;
  }

  tacticalCuesFor(participantId:string) {
    return [...(this.externalLink16Cues.get(participantId)??[]),
      ...(this.externalLink11Cues.get(participantId)??[])];
  }

  recordCueSearchUse(participantId: string, cue: AirTrack, time = this.currentTime) {
    if (cue.source !== "link11" && cue.source !== "link16") return;
    this.recordTacticalNetworkDecision({
      network: cue.source,
      kind: "cue-accepted-search",
      time,
      participantId,
      trackId: cue.targetId,
    });
    this.recordTacticalNetworkDecision({
      network: cue.source,
      kind: "weapon-authorization-rejected",
      time,
      participantId,
      trackId: cue.targetId,
    });
  }

  link16CuesFor(participantId: string) {
    return this.externalLink16Cues.get(participantId) ?? [];
  }

  link16Participants() {
    return [...this.activeLink16ParticipantIds];
  }

  link11Participants() { return [...this.activeLink11ParticipantIds]; }

  aewCommands(time=this.currentTime){return this.aewCommandNetwork.active(time);}

  private recordTacticalNetworkDecision(
    decision: Omit<TacticalNetworkDecisionView, "id">,
  ) {
    const key = `${decision.kind}:${decision.participantId}:${decision.trackId}:${decision.organicTargetId ?? ""}`;
    if (this.tacticalNetworkDecisionKeys.has(key)) return;
    this.tacticalNetworkDecisionKeys.add(key);
    this.tacticalNetworkDecisions.push({
      ...decision,
      id: `${key}:${++this.tacticalNetworkDecisionSerial}`,
    });
    if (decision.kind === "cue-expired")
      for (const recordedKey of [...this.tacticalNetworkDecisionKeys])
        if (recordedKey.includes(`:${decision.participantId}:${decision.trackId}:`))
          this.tacticalNetworkDecisionKeys.delete(recordedKey);
    if (this.tacticalNetworkDecisions.length > 512)
      this.tacticalNetworkDecisions.splice(0, this.tacticalNetworkDecisions.length - 512);
  }

  private pruneExternalCues(time: number) {
    const prune = (network: "link11" | "link16", store: Map<string, AirTrack[]>) => {
      const maximumAge = network === "link11" ? 24 : 8;
      for (const [participantId, tracks] of store) {
        const retained = tracks.filter((track) => time - track.lastUpdate <= maximumAge && track.quality >= 0.04);
        for (const track of tracks)
          if (!retained.includes(track))
            this.recordTacticalNetworkDecision({ network, kind: "cue-expired", time, participantId, trackId: track.targetId });
        if (retained.length) store.set(participantId, retained);
        else store.delete(participantId);
      }
    };
    prune("link11", this.externalLink11Cues);
    prune("link16", this.externalLink16Cues);
  }

  tacticalNetworkObservation(time = this.currentTime): TacticalNetworkObservation {
    const context = this.group.userData.context as AirScenarioContext | undefined;
    const link11Diagnostics = this.link11.diagnostics();
    const tracks: TacticalNetworkTrackView[] = [];
    const seen = new Set<string>();
    const appendTrack = (track: AirTrack) => {
      if ((track.source !== "link11" && track.source !== "link16") || seen.has(track.targetId)) return;
      seen.add(track.targetId);
      tracks.push({id:track.targetId,network:track.source,position:track.position.clone(),
        uncertainty:track.uncertainty,quality:track.quality,age:Math.max(0,time-track.lastUpdate),
        classification:track.classification,senderId:track.senderId});
    };
    for(const cues of this.externalLink11Cues.values())for(const track of cues)appendTrack(track);
    for(const cues of this.externalLink16Cues.values())for(const track of cues)appendTrack(track);
    for(const aircraft of this.aircraft)for(const track of aircraft.networkTracks.values())appendTrack(track);
    return {
      era:context?.datalinkEra??"link16-modernized",
      enabled:context?.datalinkEnabled??context?.link16Enabled??true,
      nodes:[
        ...this.link11.participantStates().map(node=>({...node,network:"link11" as const,
          role:(node.id===link11Diagnostics.netControlStation?"ncs":"participant") as "ncs"|"participant"})),
        ...this.link16.participantStates().map(node=>({...node,network:"link16" as const,role:"participant" as const})),
      ],
      tracks,
      activities:[...this.link11.recentActivities(time),...this.link16.recentActivities(time)]
        .sort((a,b)=>a.time-b.time),
      decisions:this.tacticalNetworkDecisions.filter((decision)=>time-decision.time<=30),
      link11:link11Diagnostics,
      link16:this.link16.diagnostics(),
    };
  }

  private updateFlightVisuals(aircraft: AirPlatformInstance, time: number, dt: number) {
    const speedRatio = clamp(
        aircraft.velocity.length() / aircraft.definition.flight.maxSpeed,
        0,
        1,
      ),
      engineHealth =
        ((aircraft.subsystemHealth.get("left-engine") ?? 0) +
          (aircraft.subsystemHealth.get("right-engine") ?? 0)) /
        200,
      exhausts = aircraft.model.userData.exhausts as THREE.Mesh[] | undefined,
      contrails = aircraft.model.userData.contrails as THREE.Mesh[] | undefined;
    updateAewModelAnimation(
      aircraft.model,
      dt,
      aircraft.alive && (aircraft.subsystemHealth.get("radar") ?? 0) > 5,
      speedRatio,
    );
    const modeVisual = aircraft.thrustMode === "afterburner"
      ? { width: 1.35, length: 2.8, opacity: 0.88, color: 0x80bfff }
      : aircraft.thrustMode === "military"
        ? { width: 1.05, length: 1.45, opacity: 0.58, color: 0xffa34f }
        : aircraft.thrustMode === "cruise"
          ? { width: 0.78, length: 0.72, opacity: 0.3, color: 0xff7a32 }
          : { width: 0.5, length: 0.18, opacity: 0.08, color: 0xff5a24 };
    exhausts?.forEach((exhaust, index) => {
      const pulse = 1 + Math.sin(time * 17 + index * 1.7) * 0.08,
        length = modeVisual.length * (0.85 + speedRatio * 0.3) * engineHealth * pulse;
      exhaust.visible = aircraft.alive && engineHealth > 0.05;
      exhaust.scale.set(modeVisual.width, length, modeVisual.width);
      const material = exhaust.material as THREE.MeshBasicMaterial;
      material.opacity = modeVisual.opacity;
      material.color.setHex(modeVisual.color);
    });
    const maneuverVapor =
      aircraft.position.y > 14 &&
      (speedRatio > 0.82 || Math.abs(aircraft.bank) > 0.72);
    contrails?.forEach((trail, index) => {
      trail.visible = maneuverVapor && aircraft.alive;
      const length = 1.5 + speedRatio * 3.5 + Math.abs(aircraft.bank) * 0.8;
      trail.scale.set(0.8 + Math.abs(aircraft.bank) * 0.3, length, 0.8);
      trail.position.z = aircraft.definition.flight.maxSpeed * 0.25 + length * 0.5;
      (trail.material as THREE.MeshBasicMaterial).opacity = trail.visible
        ? 0.045 + speedRatio * 0.11 + Math.sin(time * 5 + index) * 0.012
        : 0;
    });
  }

  private updateDamageVisuals(aircraft: AirPlatformInstance, time: number) {
    const structure = (aircraft.subsystemHealth.get("structure") ?? 100) / 100,
      left = (aircraft.subsystemHealth.get("left-engine") ?? 100) / 100,
      right = (aircraft.subsystemHealth.get("right-engine") ?? 100) / 100,
      severity = clamp(1 - Math.min(structure, (left + right) / 2), 0, 1),
      smoke = aircraft.model.userData.damageSmoke as THREE.Mesh | undefined,
      fire = aircraft.model.userData.damageFire as THREE.Mesh | undefined,
      splash = aircraft.model.userData.crashSplash as THREE.Mesh | undefined;
    if (smoke) {
      smoke.visible =
        severity > 0.18 ||
        aircraft.state === "disabled" ||
        aircraft.state === "crashed";
      (smoke.material as THREE.MeshBasicMaterial).opacity = smoke.visible
        ? 0.25 + severity * 0.45
        : 0;
      smoke.scale.setScalar(
        1 + severity * 2 + Math.sin(time * 4 + aircraft.formationIndex) * 0.12,
      );
    }
    if (fire) {
      fire.visible = severity > 0.48 || aircraft.state === "disabled";
      (fire.material as THREE.MeshBasicMaterial).opacity = fire.visible
        ? 0.5 + severity * 0.35
        : 0;
      fire.scale.setScalar(0.8 + severity * 0.9 + Math.sin(time * 8) * 0.1);
    }
    if (splash && aircraft.state === "crashed") {
      splash.visible = true;
      const age = (aircraft.model.userData.crashAge as number | undefined) ?? 0,
        updated = age + 0.05;
      aircraft.model.userData.crashAge = updated;
      splash.scale.setScalar(1 + updated * 2.2);
      (splash.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.85 - updated * 0.18,
      );
    }
  }

  private updateFormationState(aircraft: AirPlatformInstance) {
    if (aircraft.formationIndex === 0) {
      aircraft.formationStatus = "joined";
      aircraft.formationError = 0;
      return;
    }
    const leader = this.aircraft.find(
      (candidate) => candidate.id === aircraft.leaderId && candidate.alive,
    );
    if (!leader) {
      aircraft.formationStatus = "separated";
      aircraft.formationError = Infinity;
      return;
    }
    const slot = formationSlot({
        leader: leader.position,
        leaderHeading: leader.heading,
        lateral: aircraft.formationIndex % 2 ? 12 : -12,
        vertical: 2,
        trail: 10,
      }),
      slotPosition = new THREE.Vector3(slot.x, slot.y, slot.z);
    aircraft.formationError = aircraft.position.distanceTo(slotPosition);
    aircraft.formationStatus = updateFormationStatus({
      current: aircraft.formationStatus,
      error: aircraft.formationError,
      joinDistance: 8,
      breakDistance: 45,
    });
    if (
      (aircraft.formationStatus === "separated" ||
        aircraft.formationStatus === "rejoining") &&
      aircraft.state !== "defending"
    ) {
      aircraft.desiredDirection
        .copy(slotPosition)
        .sub(aircraft.position)
        .normalize();
      aircraft.state = "formation";
    }
  }

  shipDefenseContacts(defender: TargetableEntity): AirShipDefenseContact[] {
    return [
      ...this.aircraft
        .filter((a) => a.alive && opposingSides(defender, a))
        .map((a) => ({
          entity: a,
          name: a.definition.name,
          model: a.model,
          template: a.definition.shipDefenseTemplate,
          phase: "inbound" as const,
        })),
      ...this.missiles
        .filter(
          (m) =>
            m.alive &&
            m.phase !== "destroyed" &&
            opposingSides(defender, m) &&
            m.targetId === defender.id &&
            m.definition.targets.includes("ship"),
        )
        .map((m) => ({
          entity: m,
          name: m.definition.name,
          model: m.model,
          template: m.definition.shipDefenseTemplate,
          phase: m.phase as "boost" | "midcourse" | "terminal",
        })),
    ];
  }
  private updateTracks(
    a: AirPlatformInstance,
    time: number,
    dt: number,
    context: AirScenarioContext,
  ) {
    this.radarStandbyParticipants.delete(a.id);
    advanceAirTracks(a.tracks, dt, time);
    const awaitingMaritimeCue =
      a.definition.id === "TU-16K" &&
      a.mission === "anti-ship" &&
      this.sovietMaritimeTargeting.diagnostics(time).enabled &&
      !this.sovietMaritimeTargeting.cueFor(a.id, time) &&
      !this.sovietSalvoCoordinator.planFor(a.id, time) &&
      a.tracks.size === 0 &&
      time < 12;
    if (awaitingMaritimeCue) {
      this.radarStandbyParticipants.add(a.id);
      return;
    }
    const gciCommand = this.sovietGci.commandFor(a.id, time);
    const aewCommand = this.aewCommandNetwork.commandFor(a.id, time);
    const interceptCommand = gciCommand ?? aewCommand;
    const awaitingGciCommand =
      a.definition.id === "MIG-29A" &&
      a.mission === "intercept" &&
      this.sovietGci.diagnostics(time).enabled &&
      !interceptCommand &&
      a.tracks.size === 0 &&
      time < 12;
    if (awaitingGciCommand) {
      this.radarStandbyParticipants.add(a.id);
      return;
    }
    if (
      a.definition.id === "MIG-29A" &&
      interceptCommand &&
      a.tracks.size === 0 &&
      a.position.distanceTo(interceptCommand.interceptPoint) > interceptCommand.radarActivationRange
    ) {
      this.radarStandbyParticipants.add(a.id);
      return;
    }
    const maritimeCue = this.sovietMaritimeTargeting.cueFor(a.id, time);
    if (
      a.definition.id === "TU-16K" &&
      a.mission === "anti-ship" &&
      maritimeCue &&
      a.tracks.size === 0 &&
      a.position.distanceTo(maritimeCue.launchRegionCenter) > 160
    ) return;
    if (time < a.nextScan || !a.alive) return;
    a.nextScan = time + a.definition.sensor.updateInterval * (interceptCommand ? .75 : 1);
    const radarHealth = (a.subsystemHealth.get("radar") ?? 0) / 100;
    for (const target of this.entities(context)) {
      if (!opposingSides(a, target) || target.id === a.id || !target.alive)
        continue;
      const offset = target.position.clone().sub(a.position),
        range = offset.length(),
        gciSearchDirection = interceptCommand?.interceptPoint.clone().sub(a.position),
        gciFocused = !!gciSearchDirection &&
          angle(gciSearchDirection, offset) <= 24 + (1 - (gciCommand?.quality ?? 0)) * 12,
        focusedPrecision = Math.min(
          1,
          a.definition.sensor.precision * (gciFocused ? 1 + (interceptCommand?.quality ?? 0) * .16 : 1),
        ),
        ecm =
          target.kind === "aircraft"
            ? (target as AirPlatformInstance).definition.ecm
            : undefined,
        factors = airRadarFactors({
          sensorAltitude: a.position.y,
          targetAltitude: target.position.y,
          range,
          nominalRange: a.definition.sensor.range,
          targetRcs: target.radarCrossSection,
          radarHealth,
          precision: focusedPrecision,
          ecmStrength: ecm?.strength,
          burnThroughRange: ecm?.burnThroughRange,
        }),
        boresight = a.definition.sensor.coverage === "rotating-360"
          ? 0
          : angle(a.heading, offset);
      const key =
        ((time / a.definition.sensor.updateInterval) | 0) +
        this.serial +
        target.id.length +
        a.id.length;
      if (
        range <= factors.effectiveRange &&
        boresight <= a.definition.sensor.fieldOfViewDeg * 0.5 &&
        roll(key) < factors.probability
      ) {
        const first = !a.tracks.has(target.id),
          measurement = createAirMeasurement({
            targetId: target.id,
            targetKind: target.kind,
            position: target.position,
            velocity: target.velocity,
            quality: factors.quality,
            precision: focusedPrecision,
            time,
            noise: [roll(key + 2), roll(key + 3), roll(key + 4)],
          });
        const cue = [...a.networkTracks.values()].find((candidate) =>
          candidate.classification === measurement.classification &&
          candidate.position.distanceTo(measurement.position) <=
            Math.max(12, candidate.uncertainty + measurement.uncertainty));
        if (first && (cue?.source === "link11" || cue?.source === "link16"))
          this.recordTacticalNetworkDecision({
            network: cue.source,
            kind: "organic-acquisition",
            time,
            participantId: a.id,
            trackId: cue.targetId,
            organicTargetId: target.id,
          });
        a.tracks.set(target.id, measurement);
        const report: Omit<
          Link16TrackReport,
          "messageId" | "senderId" | "side" | "transmittedAt"
        > = {
          trackId: tacticalTrackNumber(target.id),
          originSensorId: `${a.id}:${a.definition.sensor.name}`,
          observationId: `${a.id}:${target.id}:${time.toFixed(3)}`,
          relayChain: [],
          observedAt: time,
          position: measurement.position,
          velocity: measurement.velocity,
          classification: measurement.classification,
          quality: measurement.quality,
          uncertainty: measurement.uncertainty,
          priority: target.kind === "missile" ? "emergency" : "routine",
        };
        const terminal = a.definition.datalink;
        if (
          terminal?.link16 &&
          aircraftLink16Eligible({
            era: context.datalinkEra ?? "link16-modernized",
            enabled: context.link16Enabled ?? true,
            minimumEra: terminal.minimumEra!,
          })
        )
          this.link16.publishTrack(a.id, report, time);
        if (terminal?.link11 && this.activeLink11ParticipantIds.has(a.id))
          this.link11.publishTrack(a.id, report, time);
        if (first)
          this.emit(
            time,
            "detect",
            `${a.definition.name} DETECT / ${measurement.classification.toUpperCase()} / TQ ${Math.round(measurement.quality * 100)}%${gciFocused ? " / GCI FOCUSED SEARCH" : ""}${range > factors.horizon ? " / HORIZON DEGRADED" : ""}${ecm && !factors.burned ? " / ECM" : ""}`,
          );
      }
    }
  }
  private chooseWeapon(
    a: AirPlatformInstance,
    track: AirTrack,
    defensive = false,
    advancedAi = false,
  ) {
    return chooseAirWeapon({
      aircraft: a,
      missiles: this.missiles,
      classification: track.classification,
      range: a.position.distanceTo(track.position),
      track,
      defensive,
      advancedAi,
      weaponCatalog: AIR_WEAPONS,
    });
  }
  private launch(
    a: AirPlatformInstance,
    target: CombatEntity,
    track: AirTrack,
    time: number,
    defensive = false,
  ) {
    const weapon = this.chooseWeapon(
        a,
        track,
        defensive,
        this.activeAdvancedAirAi,
      ),
      hardpoint = weapon
        ? a.hardpoints.find(
            (candidate) =>
              candidate.state === "ready" && candidate.weaponId === weapon.id,
          )
        : undefined;
    if (!weapon || !hardpoint || (a.subsystemHealth.get("weapons") ?? 0) <= 5)
      return false;
    if (this.activeAdvancedAirAi) {
      const zone = calculateDynamicLaunchZone({
        weapon,
        shooterPosition: a.position,
        shooterVelocity: a.velocity,
        shooterMaximumSpeed: a.definition.flight.maxSpeed,
        track,
      });
      a.tacticalState.lastLaunchZone = {
        rMin: zone.rMin,
        rNe: zone.rNe,
        rTr: zone.rTr,
        rMax: zone.rMax,
        range: zone.range,
      };
    }
    const authorization = commitEngagementAuthorization({
      engagements: a.engagements,
      target: target.id,
      authorize: () => {
        hardpoint.state = "reserved";
        hardpoint.targetId = target.id;
        hardpoint.commandPoint
          .copy(track.position)
          .addScaledVector(track.velocity, weapon.datalinkInterval);
        hardpoint.commandVelocity.copy(track.velocity);
        hardpoint.trackQuality = track.quality;
        hardpoint.releaseAt = time + hardpoint.releaseDelay;
        hardpoint.state = "releasing";
        return true;
      },
    });
    if (!authorization) return false;
    this.emit(
      time,
      "maneuver",
      `${a.definition.name} ${hardpoint.id.toUpperCase()} RELEASE AUTHORIZED / ${weapon.name}`,
    );
    return true;
  }
  private updateHardpointReleases(time: number) {
    for (const aircraft of this.aircraft) {
      for (const hardpoint of aircraft.hardpoints) {
        if (
          hardpoint.state !== "releasing" ||
          time < hardpoint.releaseAt ||
          !hardpoint.weaponId ||
          !hardpoint.mountedModel ||
          !hardpoint.targetId
        )
          continue;
        const weapon = AIR_WEAPONS[hardpoint.weaponId],
          model = hardpoint.mountedModel,
          worldPosition = model.getWorldPosition(new THREE.Vector3()),
          worldQuaternion = model.getWorldQuaternion(new THREE.Quaternion()),
          ejection = new THREE.Vector3(0, -1.15, 0.18).applyQuaternion(
            aircraft.model.quaternion,
          );
        aircraft.model.remove(model);
        this.group.add(model);
        model.position.copy(worldPosition);
        model.quaternion.copy(worldQuaternion);
        const velocity = aircraft.velocity.clone().add(ejection),
          releaseTrack = {
            position: hardpoint.commandPoint.clone(),
            velocity: hardpoint.commandVelocity.clone(),
            quality: hardpoint.trackQuality,
            uncertainty: (1 - hardpoint.trackQuality) * 50,
          },
          launchZone = calculateDynamicLaunchZone({
            weapon,
            shooterPosition: aircraft.position,
            shooterVelocity: aircraft.velocity,
            shooterMaximumSpeed: aircraft.definition.flight.maxSpeed,
            track: releaseTrack,
          }),
          missile: AirMissileInstance = {
            id: `air-weapon-${++this.serial}`,
            side: aircraft.side,
            kind: "missile",
            position: model.position,
            velocity,
            radarCrossSection: 0.12,
            infraredSignature: 2.2,
            alive: true,
            applyDamage: () => {
              missile.alive = false;
              missile.phase = "destroyed";
              missile.model.visible = false;
            },
            definition: weapon,
            model,
            shooterId: aircraft.id,
            targetId: hardpoint.targetId,
            engagementTargetId: hardpoint.targetId,
            age: 0,
            phase: "boost",
            commandPoint: hardpoint.commandPoint.clone(),
            nextDatalink: time,
            seekerAcquired: false,
            illuminationLostAt: null,
            softKillResolved: false,
            countermeasureRequested: false,
            countermeasureRequestedAt: -Infinity,
            ignitionDelay: hardpoint.ignitionDelay,
            releaseAge: 0,
            nextSeekerAttempt: time,
            engagementSettled: false,
            launchRange: launchZone.range,
            launchRtr: launchZone.rTr,
            launchRmax: launchZone.rMax,
            maximumAltitude: worldPosition.y,
          };
        this.missiles.push(missile);
        aircraft.ammo.set(
          weapon.id,
          Math.max(0, (aircraft.ammo.get(weapon.id) ?? 0) - 1),
        );
        hardpoint.weaponId = null;
        hardpoint.mountedModel = null;
        hardpoint.targetId = null;
        hardpoint.state = "empty";
        if (aircraft.mission === "anti-ship") {
          aircraft.mission = "egress";
          aircraft.state = "egress";
        }
        this.emit(
          time,
          "launch",
          `${aircraft.definition.name} LAUNCH ${weapon.name} / AIRFRAME ${aircraft.id} / ${hardpoint.id.toUpperCase()} / TRACK TQ ${Math.round(hardpoint.trackQuality * 100)}% / RANGE ${(launchZone.range / 10).toFixed(1)} KM / RTR ${(launchZone.rTr / 10).toFixed(1)} KM / RMAX ${(launchZone.rMax / 10).toFixed(1)} KM`,
        );
      }
    }
  }
  private incomingFor(a: AirPlatformInstance, time: number) {
    for (const m of this.missiles.filter(
      (m) => m.alive && opposingSides(a, m) && m.targetId === a.id,
    )) {
      const range = m.position.distanceTo(a.position),
        active =
          m.seekerAcquired ||
          (m.definition.guidance === "active-radar" &&
            range <= m.definition.seekerRange),
        visual = range <= 28,
        detected =
          visual ||
          roll(this.serial + m.id.length + a.id.length + Math.floor(time * 2)) <
            missileWarningProbability(range, active);
      if (detected) {
        const warningRange = active ? 150 : 70,
          quality = visual
            ? 0.95
            : clamp(0.4 + (1 - range / warningRange) * 0.5, 0.3, 0.92),
          uncertainty = (1 - quality) * 12;
        a.missileWarnings.set(m.id, {
          targetId: m.id,
          position: m.position
            .clone()
            .add(
              new THREE.Vector3(
                (roll(time + m.id.length) - 0.5) * uncertainty,
                0,
                (roll(time + m.id.length + 1) - 0.5) * uncertainty,
              ),
            ),
          velocity: m.velocity.clone(),
          quality,
          uncertainty,
          lastUpdate: time,
          classification: "unknown",
        });
      }
    }
    for (const [id, warning] of a.missileWarnings)
      if (time - warning.lastUpdate > 2.5) a.missileWarnings.delete(id);
    return [...a.missileWarnings.values()]
      .map((warning) => ({
        warning,
        missile: this.missiles.find((m) => m.id === warning.targetId),
      }))
      .filter(
        (
          contact,
        ): contact is { warning: AirTrack; missile: AirMissileInstance } =>
          !!contact.missile?.alive,
      )
      .sort(
        (x, y) =>
          x.warning.position.distanceTo(a.position) -
          y.warning.position.distanceTo(a.position),
      )[0];
  }
  private deployCountermeasures(
    a: AirPlatformInstance,
    m: AirMissileInstance,
    time: number,
  ) {
    const program = a.definition.countermeasures.program,
      isIr = m.definition.guidance === "infrared",
      type = isIr ? "flare" : "chaff",
      count = queueCountermeasureProgram({
        aircraft: a,
        type,
        requestedCount: isIr ? program.flareBurst : program.chaffBurst,
        interval: program.interval,
        cooldown: program.cooldown,
        time,
      });
    if (count > 0)
      this.emit(
        time,
        "countermeasure",
        `${a.definition.name} ${type.toUpperCase()} PROGRAM / ${count} ROUNDS / ${program.interval.toFixed(2)}s INTERVAL`,
      );
  }
  private updateCountermeasurePrograms(time: number) {
    for (const aircraft of this.aircraft) {
      const result = advanceCountermeasurePrograms(
        aircraft.countermeasurePrograms,
        { chaff: aircraft.chaff, flares: aircraft.flares },
        time,
      );
      aircraft.countermeasurePrograms = result.programs;
      aircraft.chaff = result.inventory.chaff;
      aircraft.flares = result.inventory.flares;
      for (const type of result.releases) {
        this.spawnDecoy(aircraft, type);
        this.emit(
          time,
          "countermeasure",
          `${aircraft.definition.name} ${type.toUpperCase()} EJECT`,
        );
      }
    }
  }
  private spawnDecoy(a: AirPlatformInstance, type: "chaff" | "flare") {
    const mesh = new THREE.Group();
    const particles = type === "flare" ? 7 : 10;
    for (let index = 0; index < particles; index++) {
      const particle = new THREE.Mesh(
        type === "flare"
          ? new THREE.SphereGeometry(0.1 + (index % 3) * 0.025, 6, 4)
          : new THREE.BoxGeometry(0.2, 0.018, 0.06),
        new THREE.MeshBasicMaterial({
          color: type === "flare" ? (index % 2 ? 0xffd37a : 0xff6b2f) : 0xcce4df,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      particle.position.set(
        (roll(this.serial + index * 3) - 0.5) * 1.3,
        (roll(this.serial + index * 3 + 1) - 0.5) * 0.8,
        (roll(this.serial + index * 3 + 2) - 0.5) * 1.5,
      );
      particle.rotation.set(index * 0.7, index * 1.1, index * 0.4);
      mesh.add(particle);
    }
    mesh.position
      .copy(a.position)
      .add(new THREE.Vector3((roll(this.serial) - 0.5) * 1.4, -0.4, 1));
    const d: AirDecoyInstance = {
      id: `${type}-${++this.serial}`,
      side: a.side,
      kind: "decoy",
      position: mesh.position,
      velocity: a.velocity
        .clone()
        .multiplyScalar(0.65)
        .add(
          new THREE.Vector3(
            (roll(this.serial) - 0.5) * 1.5,
            -0.3,
            (roll(this.serial + 1) - 0.5) * 1.5,
          ),
        ),
      radarCrossSection: type === "chaff" ? 18 : 0.02,
      infraredSignature: type === "flare" ? 4 : 0.02,
      alive: true,
      decoyType: type,
      model: mesh,
      age: 0,
      life: type === "chaff" ? 14 : 5,
    };
    this.decoys.push(d);
    this.group.add(mesh);
    this.onCountermeasureVisual?.(type, d.position.clone(), d.velocity.clone());
  }
  private missionTrackFor(
    a: AirPlatformInstance,
    context: AirScenarioContext,
    time = this.currentTime,
    respectFormationAssignment = false,
  ) {
    const protectedEntity = a.protectedId
      ? this.targetById(a.protectedId, context)
      : undefined;
    const fused = new Map(
      [...a.networkTracks].filter(([, network]) =>
        ![...a.tracks.values()].some(
          (local) =>
            local.classification === network.classification &&
            local.position.distanceTo(network.position) <=
              Math.max(12, local.uncertainty + network.uncertainty),
        ),
      ),
    );
    for (const [id, local] of a.tracks) fused.set(id, local);
    let selected: AirTrack | undefined;
    if (this.activeAdvancedAirAi) {
      const bindings = this.perceptionBindings.get(a.id);
      const formationBindings = this.formationPerceptionBindings.get(a.formationId);
      const assignedTargetId = a.tacticalState.formationTrackNumber
        ? formationBindings?.targetByTrackNumber.get(
            a.tacticalState.formationTrackNumber,
          )
        : undefined;
      const eligibleContacts = [...a.pilotPerception.contacts.values()].filter(
        (contact) => {
          const targetId = bindings?.targetByTrackNumber.get(contact.trackNumber);
          if (!targetId) return false;
          if (respectFormationAssignment && assignedTargetId &&
              targetId !== assignedTargetId)
            return false;
          const engagement = a.engagements.get(targetId);
          return !engagement ||
            (engagement.pending === 0 && time - engagement.lastResolution >= 2);
        },
      );
      const roleMayEngage = !respectFormationAssignment ||
        a.tacticalState.formationRole === "shooter" ||
        a.tacticalState.formationRole === "supporter";
      const contact = roleMayEngage
        ? selectPilotContact({
            mission: a.mission,
            contacts: eligibleContacts,
            origin: protectedEntity?.position ?? a.position,
          })
        : undefined;
      const binding = contact
        ? bindings?.targetByTrackNumber.get(contact.trackNumber)
        : undefined;
      selected = contact && binding
        ? contactAsRuntimeTrack(contact, binding)
        : undefined;
    } else {
      selected = selectMissionTrack({
        mission: a.mission,
        tracks: [...fused.values()],
        origin: protectedEntity?.position ?? a.position,
        engagements: a.engagements,
        time,
        reassessDelay: 2,
      });
    }
    if (selected?.source === "link11" || selected?.source === "link16") {
      this.recordTacticalNetworkDecision({
        network: selected.source,
        kind: "cue-accepted-search",
        time,
        participantId: a.id,
        trackId: selected.targetId,
      });
      this.recordTacticalNetworkDecision({
        network: selected.source,
        kind: "weapon-authorization-rejected",
        time,
        participantId: a.id,
        trackId: selected.targetId,
      });
    }
    return selected;
  }
  private updateAircraft(
    a: AirPlatformInstance,
    time: number,
    dt: number,
    context: AirScenarioContext,
  ) {
    if (!a.alive) {
      if (a.state === "disabled") {
        const loss = stepAircraftLossOfControl({
          position: a.position,
          velocity: a.velocity,
          roll: a.model.rotation.z,
          dt,
        });
        a.position.set(loss.position.x, loss.position.y, loss.position.z);
        a.velocity.set(loss.velocity.x, loss.velocity.y, loss.velocity.z);
        a.model.rotation.z = loss.roll;
        if (loss.crashed) {
          a.state = "crashed";
          a.model.visible = true;
          this.onOceanSplash?.(a.position, 2);
          this.emit(
            time,
            "kill",
            `${a.definition.name} IMPACTED SEA / WRECKAGE VISIBLE`,
          );
        }
      }
      return;
    }
    this.updateTracks(a, time, dt, context);
    if (context.advancedAirAiEnabled && time >= a.nextPilotUpdate) {
      a.pilotState = stepPilotState({
        state: a.pilotState,
        model: a.pilotModel,
        dt: 0.25,
        loadFactor: a.advancedFlightState.loadFactor,
        contactCount: a.pilotPerception.contacts.size,
        threatCount: a.missileWarnings.size,
        supportingWeapon: this.missiles.some((missile) =>
          missile.alive && missile.shooterId === a.id &&
          (!missile.seekerAcquired ||
            missile.definition.guidance === "semi-active-radar")),
        damaged: [...a.subsystemHealth.values()].some((health) => health < 75),
      });
      a.nextPilotUpdate = time + 0.25;
    }
    if (context.advancedAirAiEnabled && time >= a.nextPerceptionUpdate) {
      const bindings = this.perceptionBindings.get(a.id) ??
        initialPerceptionBindings();
      const perception = updatePilotPerception({
        state: a.pilotPerception,
        observations: [...a.tracks.values(), ...a.networkTracks.values()]
          .map((track) => perceptionObservation(track, bindings)),
        time,
        memorySeconds: a.pilotState.effectiveTrackMemorySeconds,
      });
      a.pilotPerception = perception.state;
      const liveNumbers = new Set(a.pilotPerception.contacts.keys());
      for (const [number, targetId] of bindings.targetByTrackNumber) {
        if (liveNumbers.has(number)) continue;
        bindings.targetByTrackNumber.delete(number);
        bindings.trackNumberByTarget.delete(targetId);
      }
      this.perceptionBindings.set(a.id, bindings);
      a.nextPerceptionUpdate = time +
        a.pilotState.effectivePerceptionRefreshSeconds;
    }
    if (!context.advancedAirAiEnabled && a.fuel <= 0) a.mission = "return";
    const observedTracks = [...a.tracks.values(), ...a.networkTracks.values()].filter(
        (track) => time - track.lastUpdate <= 8 && track.quality >= 0.04,
      ),
      observedHostileAircraft = observedTracks.filter(
        (track) => track.classification === "aircraft",
      ).length,
      observedThreats =
        observedTracks.filter((track) => track.classification === "unknown")
          .length + a.missileWarnings.size;
    if (observedHostileAircraft > 0 || observedThreats > 0)
      a.noContactSince = null;
    else a.noContactSince ??= time;
    const hasAirborneWeapon = this.missiles.some(
      (missile) => missile.alive && missile.shooterId === a.id,
    );
    const damagePlan = context.advancedAirAiEnabled
      ? planDamageFlight({
          mission: a.mission,
          maximumLoadFactor: a.definition.flight.maxLoadFactor,
          structureHealth: a.subsystemHealth.get("structure") ?? 0,
          leftEngineHealth: a.subsystemHealth.get("left-engine") ?? 0,
          rightEngineHealth: a.subsystemHealth.get("right-engine") ?? 0,
          radarHealth: a.subsystemHealth.get("radar") ?? 0,
          flightControlHealth: a.subsystemHealth.get("flight-control") ?? 0,
          weaponSystemHealth: a.subsystemHealth.get("weapons") ?? 0,
          alternativeCloseWeaponAvailable: [...a.ammo.entries()].some(
            ([weaponId, count]) => count > 0 &&
              AIR_WEAPONS[weaponId].guidance === "infrared",
          ),
        })
      : null;
    if (damagePlan?.recommendedOrder === "return" && a.mission !== "return") {
      a.mission = "return";
      a.state = "egress";
      this.emit(time, "maneuver",
        `${a.definition.name} DAMAGE MANAGEMENT ABORT / RETURN`);
    }
    if (context.advancedAirAiEnabled && time >= a.nextMissionPlanningUpdate) {
      const previousPhase = a.missionPlanningState.phase;
      const previousOrder = a.mission;
      const protectedAsset = a.protectedId
        ? this.aircraft.find((candidate) => candidate.id === a.protectedId)
        : undefined;
      const escortAvailable = this.aircraft.some((candidate) =>
        candidate.alive && candidate.side === a.side && candidate.id !== a.id &&
        candidate.definition.mission !== "aew" &&
        candidate.position.distanceTo(a.position) <= 220);
      const missionPlan = planAirMission({
        time,
        state: a.missionPlanningState,
        currentOrder: a.mission,
        position: a.position,
        heading: a.heading,
        fuelRemaining: a.fuel,
        fuelLeakPerSecond: damagePlan?.fuelLeakPerSecond ?? 0,
        nominalFuel: a.definition.flight.fuelSeconds,
        cruiseSpeed: a.definition.flight.cruiseSpeed,
        engineHealth: ((a.subsystemHealth.get("left-engine") ?? 0) +
          (a.subsystemHealth.get("right-engine") ?? 0)) / 200,
        flightControlHealth:
          (a.subsystemHealth.get("flight-control") ?? 0) / 100,
        radarHealth: (a.subsystemHealth.get("radar") ?? 0) / 100,
        weaponSystemHealth: (a.subsystemHealth.get("weapons") ?? 0) / 100,
        weaponsRemaining: [...a.ammo.values()].reduce(
          (total, count) => total + count,
          0,
        ),
        hasAirborneWeapon,
        hasEngaged: a.engagements.size > 0,
        contactLostSeconds: time - (a.noContactSince ?? time),
        contacts: [...a.pilotPerception.contacts.values()].map((contact) => ({
          position: contact.estimatedPosition,
          quality: contact.quality,
          classification: contact.classification,
        })),
        protectedAssetAlive: !a.protectedId || Boolean(protectedAsset?.alive),
        escortAvailable,
      });
      a.missionPlanningState = missionPlan.state;
      a.mission = missionPlan.order;
      a.nextMissionPlanningUpdate = time + 2.5;
      if (missionPlan.navigationPoint) {
        const point = new THREE.Vector3(...missionPlan.navigationPoint);
        if (missionPlan.order === "aew")
          a.model.userData.aewStation = point;
        else
          a.desiredDirection.copy(point).sub(a.position).normalize();
      }
      if (previousPhase !== missionPlan.state.phase ||
          previousOrder !== missionPlan.order)
        this.emit(
          time,
          "maneuver",
          `${a.definition.name} MISSION ${missionPlan.state.phase.toUpperCase()} / ${missionPlan.state.reason.toUpperCase()}`,
        );
    } else if (!context.advancedAirAiEnabled &&
      missionShouldReturn({
        mission: a.mission,
        hasEngaged: a.engagements.size > 0,
        observedHostileAircraft,
        observedThreats,
        contactLostSeconds: time - (a.noContactSince ?? time),
        hasAirborneWeapon,
      })) {
      a.mission = "return";
      a.state = "egress";
    }
    if (a.mission === "egress" || a.mission === "return") {
      a.state = "egress";
      a.desiredDirection.set(a.side === "blue" ? -1 : 1, 0.04, 1).normalize();
    }
    const incoming = this.incomingFor(a, time);
    if (!incoming && context.advancedAirAiEnabled &&
        a.tacticalState.threatPhase !== "monitor") {
      a.tacticalState.threatPhase = a.tacticalState.threatPhase === "recover"
        ? "monitor" : "recover";
      a.tacticalState.commandedBankLimitDeg = null;
      a.tacticalState.commandedLoadFactor = null;
    }
    if (incoming) {
      const defense = defensiveManeuverFromWarning({
        aircraftPosition: a.position,
        warningPosition: incoming.warning.position,
        warningVelocity: incoming.warning.velocity,
        side: a.formationIndex ? 1 : -1,
      });
      a.state = "defending";
      const pilotHasReacted = !context.advancedAirAiEnabled ||
        a.pilotState.threatReactionRemaining <= 0;
      if (pilotHasReacted)
        a.desiredDirection.set(
          defense.direction.x,
          defense.direction.y,
          defense.direction.z,
        );
      if (context.advancedAirAiEnabled && pilotHasReacted) {
        const response = planThreatResponse({
          ownPosition: a.position,
          currentHeading: a.heading,
          warning: incoming.warning,
          estimatedTti: defense.timeToImpact,
          guidance: incoming.missile.definition.guidance,
          preferredSide: a.formationIndex ? 1 : -1,
          altitude: a.position.y,
          speedRatio: a.velocity.length() /
            Math.max(0.1, a.definition.flight.maxSpeed),
          previousPhase: a.tacticalState.threatPhase,
        });
        const previousMode = a.tacticalState.mode;
        const previousThreatPhase = a.tacticalState.threatPhase;
        const responseMode = response.phase === "break" ? "drag" :
          response.phase === "drag" ? "drag" : "notch";
        a.tacticalState = transitionTacticalState(
          a.tacticalState,
          responseMode,
          time,
          0.3,
        );
        a.tacticalState.threatPhase = response.phase;
        a.tacticalState.energyPriority = response.energyPriority;
        a.tacticalState.commandedBankLimitDeg = response.bankLimitDeg;
        a.tacticalState.commandedLoadFactor =
          a.definition.flight.maxLoadFactor * response.loadFactorFraction;
        a.desiredDirection.copy(response.desiredDirection);
        if (a.tacticalState.mode !== previousMode)
          this.emit(time, "maneuver", `${a.definition.name} BVR ${a.tacticalState.mode.toUpperCase()}`);
        if (response.phase !== previousThreatPhase)
          this.emit(
            time,
            "maneuver",
            `${a.definition.name} THREAT RESPONSE ${response.phase.toUpperCase()} / TTI ${defense.timeToImpact.toFixed(1)}S / ${response.bankLimitDeg.toFixed(0)} DEG BANK`,
          );
      }
      const illuminatingMissile = this.missiles.find(
        (missile) =>
          missile.alive &&
          missile.shooterId === a.id &&
          missile.definition.guidance === "semi-active-radar",
      );
      const illuminationTrack = illuminatingMissile
        ? a.tracks.get(illuminatingMissile.targetId)
        : undefined;
      if (illuminationTrack) {
        const illuminationDirection = illuminationTrack.position
          .clone()
          .sub(a.position)
          .normalize();
        a.desiredDirection
          .multiplyScalar(0.35)
          .addScaledVector(illuminationDirection, 0.65)
          .normalize();
      }
      if (
        pilotHasReacted &&
        this.countermeasuresEnabled &&
        defense.timeToImpact < a.definition.countermeasures.program.triggerTti
      )
        this.deployCountermeasures(a, incoming.missile, time);
      if (pilotHasReacted && time >= a.nextOoda) {
        a.nextOoda = time + 1;
        const track = this.missionTrackFor(a, context),
          target = track ? this.targetById(track.targetId, context) : undefined,
          commandAllowsRelease = a.mission !== "anti-ship" ||
            this.strikeCommandAllowsRelease(a, time);
        const defensiveWeapon = target && track
          ? this.chooseWeapon(
              a,
              track,
              true,
              context.advancedAirAiEnabled ?? false,
            )
          : undefined;
        if (target && track && defensiveWeapon && defensiveShotAllowed({
          missileTti: defense.timeToImpact,
          trackQuality: track.quality,
          organicWeaponAuthorization: trackSupportsWeaponAuthorization(track),
          missionCommandAllowsRelease: commandAllowsRelease,
          fireAndForget: defensiveWeapon.guidance === "infrared",
        }))
          this.launch(a, target, track, time, true);
      }
    } else if (a.mission === "aew") {
      if (time >= a.nextOoda) {
        a.nextOoda = time + 1;
        const station = (a.model.userData.aewStation as THREE.Vector3 | undefined) ??
          a.position.clone();
        a.model.userData.aewStation = station;
        a.desiredDirection.copy(aewOrbitDirection({
          position:a.position,
          station,
          clockwise:a.side === "blue",
          radius:75,
        }));
        a.state = "formation";
        a.targetId = null;
      }
    } else if (
      a.mission !== "egress" &&
      a.mission !== "return" &&
      time >= a.nextOoda
    ) {
      a.nextOoda = time + 1.0;
      const missionTrack = this.missionTrackFor(a, context, time, true),
        supportingWeapon = this.missiles.find(
          (missile) => missile.alive && missile.shooterId === a.id &&
            (!missile.seekerAcquired ||
              missile.definition.guidance === "semi-active-radar"),
        ),
        supportTrack = supportingWeapon
          ? a.tracks.get(supportingWeapon.targetId)
          : undefined,
        track = missionTrack ?? supportTrack,
        target = missionTrack
          ? this.targetById(missionTrack.targetId, context)
          : undefined;
      a.targetId = track?.targetId ?? null;
      if (track) {
        a.state = "engaging";
        if (context.advancedAirAiEnabled) {
          const targetSpeedMeters = track.velocity.length() *
            WORLD_SPEED_TO_METERS_PER_SECOND;
          const targetSpecificEnergy = track.position.y *
              WORLD_ALTITUDE_TO_METERS +
            targetSpeedMeters * targetSpeedMeters / (2 * 9.81);
          const bfmPlan = track.classification === "aircraft"
            ? planBfmManeuver({
                ownPosition: a.position,
                ownVelocity: a.velocity,
                currentHeading: a.heading,
                targetTrack: track,
                formationSide: a.formationIndex ? 1 : -1,
                altitude: a.position.y,
                speedRatio: a.velocity.length() /
                  Math.max(0.1, a.definition.flight.maxSpeed),
                specificEnergyAdvantage:
                  a.advancedFlightState.specificEnergy - targetSpecificEnergy,
                time,
              })
            : null;
          const plan = bfmPlan ?? planBvrManeuver({
              ownPosition: a.position,
              currentHeading: a.heading,
              formationSide: a.formationIndex ? 1 : -1,
              targetTrack: track,
              supportingWeapon: supportingWeapon &&
                  supportingWeapon.targetId === track.targetId
                ? {
                    seekerAcquired: supportingWeapon.seekerAcquired,
                    guidance: supportingWeapon.definition.guidance,
                  }
                : undefined,
            });
          const previousMode = a.tacticalState.mode;
          a.tacticalState = transitionTacticalState(
            a.tacticalState,
            plan.mode,
            time,
          );
          a.tacticalState.energyPriority = plan.energyPriority;
          a.tacticalState.targetTrackNumber = track.targetId;
          a.tacticalState.supportedWeaponId = supportingWeapon?.id ?? null;
          const tacticalStep = Math.min(
            1,
            Math.max(0, time - a.tacticalState.lastTacticalEvaluationAt),
          );
          a.tacticalState.bfmShotWindowSeconds = updateStableShotWindow({
            previousSeconds: a.tacticalState.bfmShotWindowSeconds,
            opportunity: bfmPlan?.shotOpportunity ?? false,
            elapsedSeconds: tacticalStep,
          });
          a.tacticalState.lastTacticalEvaluationAt = time;
          a.tacticalState.commandedBankLimitDeg =
            bfmPlan?.bankLimitDeg ?? null;
          a.tacticalState.commandedLoadFactor = bfmPlan
            ? a.definition.flight.maxLoadFactor * bfmPlan.loadFactorFraction
            : null;
          a.desiredDirection.copy(plan.desiredDirection);
          if (a.tacticalState.mode !== previousMode)
            this.emit(
              time,
              "maneuver",
              `${a.definition.name} ${a.tacticalState.mode.startsWith("bfm-") ? "BFM" : "BVR"} ${a.tacticalState.mode.toUpperCase()}`,
            );
        } else
          a.desiredDirection.copy(track.position).sub(a.position).normalize();
        const plannedWeapon = target && missionTrack
          ? this.chooseWeapon(a, missionTrack, false,
              context.advancedAirAiEnabled ?? false)
          : undefined;
        if (
          target && missionTrack &&
          (!a.tacticalState.mode.startsWith("bfm-") ||
            Boolean(plannedWeapon) &&
            a.tacticalState.bfmShotWindowSeconds >=
              minimumStableShotSeconds(plannedWeapon!.guidance)) &&
          trackSupportsWeaponAuthorization(missionTrack) &&
          missionTrack.quality >= 0.22 &&
          this.strikeCommandAllowsRelease(a, time)
        )
          this.launch(a, target, missionTrack, time);
      } else {
        const leader = this.aircraft.find(
          (x) => x.id === a.leaderId && x.alive,
        );
        const gciCommand = this.sovietGci.commandFor(a.id, time) ??
          this.aewCommandNetwork.commandFor(a.id, time);
        const maritimeCue = this.sovietMaritimeTargeting.cueFor(a.id, time);
        const fleetOrder = this.fleetOrderForAircraft(a, time);
        const salvoPlan = this.sovietSalvoCoordinator.planFor(a.id, time);
        if (salvoPlan && a.mission === "anti-ship") {
          a.state = "engaging";
          a.desiredDirection
            .copy(salvoPlan.searchPoint)
            .sub(a.position)
            .normalize();
        } else if (fleetOrder && a.mission === "anti-ship") {
          a.state = "engaging";
          a.desiredDirection
            .copy(fleetOrder.approachPoint)
            .sub(a.position)
            .normalize();
        } else if (maritimeCue && a.mission === "anti-ship") {
          a.state = "engaging";
          a.desiredDirection
            .copy(maritimeCue.launchRegionCenter)
            .sub(a.position)
            .normalize();
        } else if (gciCommand) {
          a.state = "engaging";
          a.desiredDirection
            .copy(gciCommand.interceptPoint)
            .setY(gciCommand.commandedAltitude)
            .sub(a.position)
            .normalize();
        } else if (leader) {
          const slot = formationSlot({
            leader: leader.position,
            leaderHeading: leader.heading,
            lateral: a.formationIndex % 2 ? 12 : -12,
            vertical: 2,
            trail: 10,
          });
          a.desiredDirection
            .set(slot.x, slot.y, slot.z)
            .sub(a.position)
            .normalize();
        } else {
          const direction = noContactMissionDirection({
            mission: a.mission,
            side: a.side,
            currentHeading: a.heading,
          });
          a.desiredDirection
            .set(direction.x, direction.y, direction.z)
            .normalize();
        }
      }
    }
    const activeGciCommand = this.sovietGci.commandFor(a.id, time) ??
      this.aewCommandNetwork.commandFor(a.id, time),
      targetTrack = a.targetId ? a.tracks.get(a.targetId) : undefined,
      targetRange = targetTrack ? targetTrack.position.distanceTo(a.position) : null,
      weaponMaxRange = Math.max(0, ...[...a.ammo.entries()]
        .filter(([, count]) => count > 0)
        .map(([id]) => AIR_WEAPONS[id].maxRange)),
      missileTti = incoming ? incoming.warning.position.distanceTo(a.position) /
        Math.max(1, incoming.warning.velocity.length()) : null,
      climbDemand = a.desiredDirection.y - a.heading.y;
    const previousThrustMode = a.thrustMode;
    a.thrustMode = selectThrustMode({
      mission: a.mission,
      state: a.state,
      fuelRatio: a.fuel / Math.max(1, a.definition.flight.fuelSeconds),
      afterburnerAvailable: a.definition.flight.thrust.afterburnerAvailable,
      afterburnerRemaining: a.afterburnerRemaining,
      missileTti,
      targetRange,
      weaponMaxRange,
      speedRatio: a.velocity.length() / a.definition.flight.maxSpeed,
      desiredSpeedRatio: activeGciCommand
        ? activeGciCommand.commandedSpeed / a.definition.flight.maxSpeed
        : null,
      climbDemand,
    });
    if (a.thrustMode !== previousThrustMode) {
      this.emit(
        time,
        "maneuver",
        `${a.definition.id} THRUST ${previousThrustMode.toUpperCase()} -> ${a.thrustMode.toUpperCase()}`,
      );
    }
    const fc = (a.subsystemHealth.get("flight-control") ?? 0) / 100,
      eng =
        ((a.subsystemHealth.get("left-engine") ?? 0) +
          (a.subsystemHealth.get("right-engine") ?? 0)) /
        200,
      flight = a.definition.flight,
      speed = a.velocity.length();
    const headingBeforeFlight = a.heading.clone();
    let newSpeed: number;
    if (context.advancedAirAiEnabled) {
      const mountedWeapons = a.hardpoints.flatMap((hardpoint) =>
        hardpoint.weaponId && hardpoint.state !== "empty"
          ? [AIR_WEAPONS[hardpoint.weaponId]]
          : []
      );
      const externalStoresMassKg = mountedWeapons.reduce(
        (total, weapon) => total + weapon.massKg,
        0,
      );
      const externalDragIndex = mountedWeapons.reduce(
        (total, weapon) => total + weapon.dragIndex,
        0,
      );
      const controlError = pilotControlError({
        pilotId: a.id,
        time,
        state: a.pilotState,
      });
      const pilotDirection = a.desiredDirection.clone()
        .applyAxisAngle(UP, THREE.MathUtils.degToRad(controlError.headingDeg));
      if (damagePlan)
        pilotDirection.applyAxisAngle(
          UP,
          THREE.MathUtils.degToRad(damagePlan.trimYawDeg),
        );
      pilotDirection.y = clamp(
        pilotDirection.y + THREE.MathUtils.degToRad(controlError.pitchDeg),
        -0.9,
        damagePlan?.maximumVerticalCommand ?? 0.9,
      );
      pilotDirection.normalize();
      const advancedStep = stepFlightDirector({
        definition: a.definition,
        state: a.advancedFlightState,
        heading: a.heading,
        speed,
        altitude: a.position.y,
        bankRad: a.bank,
        flightControlHealth: fc,
        engineHealth: eng,
        afterburnerRemaining: a.afterburnerRemaining,
        externalStoresMassKg,
        externalDragIndex,
        intent: {
          desiredDirection: pilotDirection,
          thrustMode: a.thrustMode,
          energyPriority: a.tacticalState.energyPriority,
          bankLimitDeg: a.tacticalState.commandedBankLimitDeg === null
            ? damagePlan?.maximumBankDeg
            : Math.min(
                a.tacticalState.commandedBankLimitDeg,
                damagePlan?.maximumBankDeg ?? 84,
              ),
          loadFactorCommand: a.tacticalState.commandedLoadFactor === null
            ? undefined
            : Math.min(
                a.tacticalState.commandedLoadFactor,
                a.pilotState.gToleranceAvailable,
                damagePlan?.maximumLoadFactor ??
                  a.definition.flight.maxLoadFactor,
              ),
        },
        dt,
      });
      a.advancedFlightState = advancedStep.state;
      a.bank = advancedStep.bankRad;
      a.heading.copy(advancedStep.heading);
      a.fuel = consumeFuel(
        a.fuel,
        advancedStep.fuelBurn + (damagePlan?.fuelLeakPerSecond ?? 0) * dt,
      );
      a.thrustMode = advancedStep.thrustMode;
      a.afterburnerRemaining = Math.max(
        0,
        a.afterburnerRemaining - advancedStep.afterburnerUsed,
      );
      if (advancedStep.state.stalled) a.state = "defending";
      newSpeed = advancedStep.speed;
    } else {
      const desiredBank = clamp(
        Math.atan2(
          a.heading.clone().cross(a.desiredDirection).y,
          a.heading.dot(a.desiredDirection),
        ) * 3,
        -1.15,
        1.15,
      );
      const flightStep = stepFlightDynamics({
        speed,
        currentBank: THREE.MathUtils.radToDeg(a.bank),
        desiredBank: THREE.MathUtils.radToDeg(desiredBank),
        flightPathAngleDeg: THREE.MathUtils.radToDeg(
          Math.asin(clamp(a.heading.y, -1, 1)),
        ),
        desiredFlightPathAngleDeg: THREE.MathUtils.radToDeg(
          Math.asin(clamp(a.desiredDirection.y, -1, 1)),
        ),
        flightControlHealth: fc,
        engineHealth: eng,
        thrustMode: a.thrustMode,
        afterburnerRemaining: a.afterburnerRemaining,
        dt,
        envelope: flight,
      });
      a.bank = THREE.MathUtils.degToRad(flightStep.bank);
      const pitchLimited = a.heading.clone();
      pitchLimited.y = Math.sin(
        THREE.MathUtils.degToRad(
          THREE.MathUtils.radToDeg(Math.asin(clamp(a.heading.y, -1, 1))) +
            flightStep.pitchDelta,
        ),
      );
      pitchLimited.normalize();
      const horizontalDesired = a.desiredDirection.clone();
      horizontalDesired.y = pitchLimited.y;
      horizontalDesired.normalize();
      const next = rotateToward(
        a.heading,
        horizontalDesired,
        THREE.MathUtils.degToRad(flightStep.maximumTurnRateDeg) * dt,
      );
      a.heading.copy(next);
      if (flightStep.stalled) {
        a.heading.y = Math.max(-0.18, a.heading.y - 0.25 * dt);
        a.state = "defending";
      }
      a.fuel = consumeFuel(a.fuel, flightStep.fuelBurn);
      a.thrustMode = flightStep.thrustMode;
      a.afterburnerRemaining = Math.max(
        0,
        a.afterburnerRemaining - flightStep.afterburnerUsed,
      );
      newSpeed = flightStep.speed;
    }
    const actualTurnRateDeg = dt > 0
      ? THREE.MathUtils.radToDeg(headingBeforeFlight.angleTo(a.heading)) / dt
      : 0;
    a.model.userData.actualTurnRateDeg = actualTurnRateDeg;
    a.model.userData.maximumTurnRateDeg = Math.max(
      Number(a.model.userData.maximumTurnRateDeg ?? 0),
      actualTurnRateDeg,
    );
    if (incoming && context.advancedAirAiEnabled) {
      const threatRadial = incoming.warning.position.clone()
        .sub(a.position).setY(0);
      const horizontalHeading = a.heading.clone().setY(0);
      if (threatRadial.lengthSq() > 1e-6 && horizontalHeading.lengthSq() > 1e-6) {
        const beamRadialDot = Math.abs(
          threatRadial.normalize().dot(horizontalHeading.normalize()),
        );
        a.model.userData.threatBeamRadialDot = beamRadialDot;
        a.model.userData.minimumThreatBeamRadialDot = Math.min(
          Number(a.model.userData.minimumThreatBeamRadialDot ?? 1),
          beamRadialDot,
        );
      }
    }
    const thrustIr = a.thrustMode === "afterburner"
      ? flight.thrust.afterburnerInfraredMultiplier
      : a.thrustMode === "military"
        ? flight.thrust.militaryInfraredMultiplier
        : a.thrustMode === "idle" ? 0.45 : 1;
    a.infraredSignature = a.definition.infraredSignature * thrustIr;
    a.velocity.copy(a.heading).multiplyScalar(newSpeed);
    a.position.addScaledVector(a.velocity, dt);
    a.position.y = Math.max(0.25, a.position.y);
    a.model.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      a.heading,
    );
    a.model.rotateZ(-a.bank);
    const wings = a.model.userData.variableWings as
      THREE.Object3D[] | undefined;
    if (wings) {
      const sweep = THREE.MathUtils.lerp(
        0.28,
        0.9,
        clamp(
          (newSpeed - flight.cruiseSpeed) /
            (flight.maxSpeed - flight.cruiseSpeed),
          0,
          1,
        ),
      );
      wings.forEach(
        (w, i) => (w.rotation.y = (i ? 0.0 : 0) + (i % 2 ? 1 : -1) * sweep),
      );
    }
  }
  private targetById(id: string, context: AirScenarioContext) {
    return this.entities(context).find((e) => e.id === id);
  }
  private terminateMissile(
    missile: AirMissileInstance,
    result: "hit" | "miss" | "cancel" = "cancel",
    time = this.currentTime,
  ) {
    missile.alive = false;
    missile.phase = "destroyed";
    missile.model.visible = false;
    if (!missile.engagementSettled) {
      const shooter = this.aircraft.find(
        (candidate) => candidate.id === missile.shooterId,
      );
      if (shooter)
        resolveEngagement(
          shooter.engagements,
          missile.engagementTargetId,
          result,
          time,
        );
      missile.engagementSettled = true;
    }
  }
  private updateReleasedMissile(missile: AirMissileInstance, dt: number) {
    missile.releaseAge += dt;
    if (missile.releaseAge >= missile.ignitionDelay) return false;
    missile.velocity.y -= 0.42 * dt;
    missile.position.addScaledVector(missile.velocity, dt);
    const flame = missile.model.userData.flame as THREE.Mesh | undefined;
    if (flame) flame.visible = false;
    return true;
  }
  private updateMissileAfterTargetLoss(
    missile: AirMissileInstance,
    dt: number,
  ) {
    missile.age += dt;
    missile.seekerAcquired = false;
    if (
      !shouldContinueAfterTargetLoss({
        age: missile.age,
        maximumAge: missile.definition.airToAirFlight?.maximumFlightSeconds ?? 180,
        altitude: missile.position.y,
      })
    ) {
      this.terminateMissile(missile);
      return;
    }
    const flight = missile.definition.airToAirFlight;
    this.integrateAirToAirMissile(
      missile,
      flight
        ? airToAirMidcourseAimPoint({
            commandPoint: missile.commandPoint,
            missilePosition: missile.position,
            seekerAcquired: false,
            loftAltitude: flight.loftAltitude,
            loftTransitionRange: flight.loftTransitionRange,
          })
        : missile.commandPoint.clone(),
      dt,
    );
  }
  private updateMissileDatalink(
    missile: AirMissileInstance,
    target: AirRuntimeTarget,
    shooter: AirPlatformInstance | undefined,
    time: number,
  ) {
    if (missile.phase !== "midcourse" || time < missile.nextDatalink) return;
    missile.nextDatalink = time + missile.definition.datalinkInterval;
    const track = shooter?.tracks.get(target.id);
    if (track)
      missile.commandPoint
        .copy(track.position)
        .addScaledVector(track.velocity, missile.definition.datalinkInterval);
  }
  private matchingDecoy(missile: AirMissileInstance, target: AirRuntimeTarget) {
    return this.decoys
      .filter(
        (decoy) =>
          decoy.alive &&
          decoy.side === target.side &&
          decoy.position.distanceTo(target.position) < 30 &&
          angle(
            missile.velocity,
            decoy.position.clone().sub(missile.position),
          ) <=
            missile.definition.seekerFovDeg * 0.5 &&
          ((missile.definition.guidance === "infrared" &&
            decoy.decoyType === "flare") ||
            (missile.definition.guidance !== "infrared" &&
              decoy.decoyType === "chaff")),
      )
      .sort(
        (left, right) =>
          left.position.distanceTo(missile.position) -
          right.position.distanceTo(missile.position),
      )[0];
  }
  private attemptMissileSeekerCapture(
    missile: AirMissileInstance,
    target: AirRuntimeTarget,
    decoy: AirDecoyInstance | undefined,
    range: number,
    time: number,
  ) {
    if (
      missile.phase !== "terminal" ||
      missile.seekerAcquired ||
      time < missile.nextSeekerAttempt
    )
      return;
    missile.nextSeekerAttempt = time + 0.25;
    const offBoresight = angle(
      missile.velocity,
      target.position.clone().sub(missile.position).normalize(),
    );
    let captureProbability = 0;
    if (
      missile.definition.guidance === "infrared" &&
      target.kind === "aircraft"
    ) {
      const aircraftTarget = target as AirPlatformInstance,
        targetToMissile = missile.position
          .clone()
          .sub(target.position)
          .normalize(),
        rearAspect = clamp(
          -target.velocity.clone().normalize().dot(targetToMissile),
          0,
          1,
        ),
        engineHealth =
          ((aircraftTarget.subsystemHealth.get("left-engine") ?? 0) +
            (aircraftTarget.subsystemHealth.get("right-engine") ?? 0)) /
          200;
      captureProbability = infraredSeekerCaptureProbability({
        range,
        seekerRange: missile.definition.seekerRange,
        offBoresightDeg: offBoresight,
        fieldOfViewDeg: missile.definition.seekerFovDeg,
        infraredSignature:
          target.infraredSignature * (0.55 + 0.45 * engineHealth),
        rearAspect,
        targetAltitude: target.position.y,
        flareSignal: decoy?.infraredSignature,
      });
    } else if (missile.definition.guidance !== "infrared") {
      const ecm =
        target.kind === "aircraft"
          ? (target as AirPlatformInstance).definition.ecm
          : undefined;
      captureProbability = radarSeekerCaptureProbability({
        range,
        seekerRange: missile.definition.seekerRange,
        offBoresightDeg: offBoresight,
        fieldOfViewDeg: missile.definition.seekerFovDeg,
        targetRcs: target.radarCrossSection,
        ecmStrength: ecm?.strength ?? 0,
        burnThroughRange: ecm?.burnThroughRange ?? 0,
      });
    }
    if (
      roll(this.serial + missile.id.length + Math.floor(time * 4)) <
      captureProbability
    ) {
      missile.seekerAcquired = true;
      this.emit(
        time,
        "detect",
        `${missile.definition.name} SEEKER ACQUIRED / ${Math.round(captureProbability * 100)}% SOLUTION`,
      );
    }
  }
  private maintainMissileIllumination(
    missile: AirMissileInstance,
    target: AirRuntimeTarget,
    shooter: AirPlatformInstance | undefined,
    time: number,
  ) {
    if (missile.definition.guidance !== "semi-active-radar") return true;
    const track = shooter?.tracks.get(target.id),
      offset =
        track && shooter
          ? track.position.clone().sub(shooter.position)
          : undefined,
      illuminating = semiActiveIlluminationValid({
        shooterAlive: !!shooter?.alive,
        trackClassification: track?.classification ?? "unknown",
        trackQuality: track?.quality ?? 0,
        trackAge: track ? time - track.lastUpdate : Infinity,
        maximumTrackAge: (shooter?.definition.sensor.updateInterval ?? 0) * 2.2,
        offBoresightDeg:
          offset && shooter ? angle(shooter.heading, offset) : Infinity,
        illuminationFieldOfViewDeg:
          shooter?.definition.sensor.fieldOfViewDeg ?? 0,
      });
    if (!illuminating) missile.illuminationLostAt ??= time;
    else missile.illuminationLostAt = null;
    if (
      missile.illuminationLostAt === null ||
      time - missile.illuminationLostAt <= 1.5
    )
      return true;
    this.terminateMissile(missile);
    this.emit(time, "guidance", `${missile.definition.name} LOST ILLUMINATION`);
    return false;
  }
  private missileAimPoint(
    missile: AirMissileInstance,
    target: AirRuntimeTarget,
    decoy: AirDecoyInstance | undefined,
    range: number,
    dt: number,
    time: number,
  ) {
    const targetEcm =
        target.kind === "aircraft"
          ? (target as AirPlatformInstance).definition.ecm
          : undefined,
      burnedThrough = range <= (targetEcm?.burnThroughRange ?? 0),
      measurementUncertainty =
        (1 - missile.definition.countermeasureResistance) * range * 0.025 +
        (burnedThrough ? 0 : (targetEcm?.strength ?? 0) * range * 0.018),
      measurement = missile.seekerAcquired
        ? seekerMeasurementPoint({
            targetPosition: target.position,
            uncertainty: measurementUncertainty,
            noise: [
              roll(time * 4 + missile.id.length),
              roll(time * 4 + missile.id.length + 1),
              roll(time * 4 + missile.id.length + 2),
            ],
          })
        : undefined;
    let aim = airToAirGuidancePoint({
      seekerAcquired: missile.seekerAcquired,
      commandPoint: missile.commandPoint,
      measuredTargetPosition: measurement
        ? new THREE.Vector3(measurement.x, measurement.y, measurement.z)
        : undefined,
    });
    if (
      !missile.seekerAcquired ||
      !decoy ||
      decoy.position.distanceTo(missile.position) >= range
    )
      return aim;
    const signal =
        missile.definition.guidance === "infrared"
          ? decoy.infraredSignature
          : decoy.radarCrossSection,
      targetSignal =
        missile.definition.guidance === "infrared"
          ? target.infraredSignature
          : target.radarCrossSection,
      ecm =
        target.kind === "aircraft"
          ? (target as AirPlatformInstance).definition.ecm
          : undefined,
      burned = range <= (ecm?.burnThroughRange ?? 0),
      capture =
        (signal / (signal + targetSignal)) *
          (1 - missile.definition.countermeasureResistance) +
        (burned ? 0 : (ecm?.strength ?? 0) * 0.2);
    if (roll(this.serial + missile.age * 7) < capture * dt * 2.2) {
      aim = decoy.position.clone();
      missile.targetId = decoy.id;
      this.emit(
        time,
        "countermeasure",
        `${missile.definition.name} DECOY CAPTURE / ${decoy.decoyType.toUpperCase()}`,
      );
    }
    return aim;
  }
  private integrateAirToAirMissile(
    missile: AirMissileInstance,
    aim: THREE.Vector3,
    dt: number,
  ) {
    const flight = missile.definition.airToAirFlight,
      desired = aim.sub(missile.position).normalize(),
      turn = THREE.MathUtils.degToRad(missile.definition.maxTurnRateDeg) * dt;
    missile.velocity.copy(
      rotateToward(
        missile.velocity.clone().normalize(),
        desired,
        turn,
      ).multiplyScalar(flight
        ? stepAirToAirPropulsion({
            currentSpeed: missile.velocity.length(),
            nominalSpeed: missile.definition.speed,
            age: missile.age,
            boostSeconds: missile.definition.boostSeconds,
            sustainSeconds: flight.sustainSeconds,
            coastDragPerSecond: flight.coastDragPerSecond,
            minimumSpeedFactor: flight.minimumSpeedFactor,
            dt,
          })
        : missile.definition.speed),
    );
    missile.position.addScaledVector(missile.velocity, dt);
    missile.maximumAltitude = Math.max(missile.maximumAltitude, missile.position.y);
    missile.model.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      missile.velocity.clone().normalize(),
    );
    const flame = missile.model.userData.flame as THREE.Mesh | undefined;
    if (flame) flame.visible = missile.age < missile.definition.boostSeconds;
  }
  private resolveAirToAirFuze(
    missile: AirMissileInstance,
    target: AirRuntimeTarget,
    range: number,
    time: number,
  ) {
    if (range <= missile.definition.proximityRadius) {
      if (target.kind !== "decoy") {
        const fuzeEffect = THREE.MathUtils.lerp(
          1,
          0.85,
          THREE.MathUtils.clamp(range / missile.definition.proximityRadius, 0, 1),
        );
        target.applyDamage(
          missile.definition.damage * fuzeEffect,
          missile.position,
        );
        this.standardDamageApplications++;
        if (!target.alive)
          this.emit(
            time,
            "kill",
            `${missile.definition.name} INTERCEPT / ${target.id}`,
          );
        this.emit(time, "hit", `${missile.definition.name} HIT / ${target.id}`);
      }
      this.terminateMissile(
        missile,
        target.kind === "decoy" ? "miss" : "hit",
        time,
      );
      return;
    }
    if (
      missile.age >
        (missile.definition.airToAirFlight?.maximumFlightSeconds ?? 180) ||
      missile.position.y < 0
    ) {
      if (missile.position.y < 0)
        this.onOceanSplash?.(missile.position, Math.min(1.4, missile.definition.damage / 80));
      this.terminateMissile(missile, "miss", time);
    }
  }
  private updateMissile(
    missile: AirMissileInstance,
    time: number,
    dt: number,
    context: AirScenarioContext,
  ) {
    if (!missile.alive || this.updateReleasedMissile(missile, dt)) return;
    const target = this.targetById(missile.targetId, context),
      shooter = this.aircraft.find(
        (aircraft) => aircraft.id === missile.shooterId,
      );
    if (!target) {
      this.updateMissileAfterTargetLoss(missile, dt);
      return;
    }
    if (missile.definition.guidance === "anti-ship-radar") {
      if (target.kind === "decoy") this.terminateMissile(missile, "miss", time);
      else
        this.updateAntiShipMissile(missile, target, shooter, time, dt, context);
      return;
    }
    const range = missile.position.distanceTo(target.position);
    missile.age += dt;
    missile.phase = airToAirMissilePhase({
      age: missile.age,
      boostSeconds: missile.definition.boostSeconds,
      commandRange: missile.position.distanceTo(missile.commandPoint),
      seekerRange: missile.definition.seekerRange,
      seekerAcquired: missile.seekerAcquired,
    });
    this.updateMissileDatalink(missile, target, shooter, time);
    const decoy = this.matchingDecoy(missile, target);
    this.attemptMissileSeekerCapture(missile, target, decoy, range, time);
    if (!this.maintainMissileIllumination(missile, target, shooter, time))
      return;
    let aim = this.missileAimPoint(missile, target, decoy, range, dt, time);
    const flight = missile.definition.airToAirFlight;
    if (flight && !missile.seekerAcquired)
      aim = airToAirMidcourseAimPoint({
        commandPoint: aim,
        missilePosition: missile.position,
        seekerAcquired: missile.seekerAcquired,
        loftAltitude: flight.loftAltitude,
        loftTransitionRange: flight.loftTransitionRange,
      });
    this.integrateAirToAirMissile(missile, aim, dt);
    this.resolveAirToAirFuze(missile, target, range, time);
  }
  private updateAntiShipMissile(
    m: AirMissileInstance,
    target: TargetableEntity,
    shooter: AirPlatformInstance | undefined,
    time: number,
    dt: number,
    context: AirScenarioContext,
  ) {
    const flight = m.definition.antiShipFlight;
    if (!flight)
      throw new Error(`${m.definition.id} missing anti-ship flight envelope`);
    const cm = context.countermeasures?.(target.id),
      burnThrough =
        !!cm &&
        (!cm.ecmEnabled ||
          cm.ecmHealth <= 0.05 ||
          resultRangeFor(m, target) <= cm.burnThroughRange),
      ecmPenalty =
        cm && cm.ecmEnabled && !burnThrough ? cm.ecmStrength * 0.42 : 0,
      rcsFactor = THREE.MathUtils.clamp(
        0.55 + (target.radarCrossSection / 20) * 0.35,
        0.55,
        0.9,
      ),
      seekerCaptureProbability =
        THREE.MathUtils.clamp(
          (burnThrough ? 0.96 : 0.82) - ecmPenalty,
          0.12,
          0.96,
        ) * rcsFactor,
      previousPhase = m.phase,
      previousAcquired = m.seekerAcquired,
      result = updateAntiShipGuidance({
        state: m,
        config: {
          boostSeconds: m.definition.boostSeconds,
          terminalRange: m.definition.seekerRange,
          seekerRange: m.definition.seekerRange,
          seekerFovDeg: m.definition.seekerFovDeg,
          boostAltitude: Math.max(flight.boostAltitude, m.position.y),
          cruiseAltitude: flight.cruiseAltitude,
          terminalAltitude: flight.terminalAltitude,
          boostSpeed: m.definition.speed * flight.boostSpeedFactor,
          cruiseSpeed: m.definition.speed * flight.cruiseSpeedFactor,
          terminalSpeed: m.definition.speed,
          midcourseTurnRateDeg: m.definition.maxTurnRateDeg,
          terminalTurnRateDeg:
            m.definition.maxTurnRateDeg * flight.terminalTurnFactor,
        },
        position: m.position,
        velocity: m.velocity,
        commandPoint: m.commandPoint,
        commandVelocity:
          shooter?.tracks.get(target.id)?.velocity ?? new THREE.Vector3(),
        targetPosition: target.position,
        targetVelocity: target.velocity,
        dt,
        seekerCaptureProbability,
        seekerSample: roll(this.serial + m.id.length + Math.floor(m.age * 4)),
      });
    m.velocity.copy(result.direction.multiplyScalar(result.speed));
    m.position.addScaledVector(m.velocity, dt);
    m.position.y = Math.max(
      0.08,
      THREE.MathUtils.lerp(
        m.position.y,
        result.desiredAltitude,
        Math.min(1, dt * (m.phase === "terminal" ? 1.4 : 0.55)),
      ),
    );
    m.model.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      m.velocity.clone().normalize(),
    );
    const flame = m.model.userData.flame as THREE.Mesh | undefined;
    if (flame) flame.visible = m.age < m.definition.boostSeconds;
    if (previousPhase !== "terminal" && m.phase === "terminal")
      this.emit(
        time,
        "maneuver",
        `${m.definition.name} ACTIVE SEARCH / COMMAND RANGE ${result.commandRange.toFixed(0)} wu`,
      );
    if (!previousAcquired && result.acquiredNow)
      this.emit(
        time,
        "detect",
        `${m.definition.name} SEEKER ACQUIRED / ${Math.round(result.captureProbability * 100)}% SOLUTION / ${burnThrough ? "BURN THROUGH" : "PROBABILISTIC"}`,
      );
    if (
      m.phase === "terminal" &&
      !m.countermeasureRequested &&
      result.targetRange <= m.definition.seekerRange
    ) {
      m.countermeasureRequested = true;
      m.countermeasureRequestedAt = time;
      const launched = context.requestShipCountermeasure?.({
        targetId: target.id,
        threatId: m.id,
        threatPosition: m.position.clone(),
      });
      if (launched)
        this.emit(
          time,
          "countermeasure",
          `${m.definition.name} DEFENDER SRBOC LAUNCH OBSERVED`,
        );
    }
    if (
      m.seekerAcquired &&
      !m.softKillResolved &&
      cm &&
      time - (m.countermeasureRequestedAt ?? -Infinity) >= 1.2
    ) {
      m.softKillResolved = true;
      const nearest = cm.decoys
          .filter((d) => d.position.distanceTo(target.position) < 30)
          .sort(
            (a, b) =>
              a.position.distanceTo(m.position) -
              b.position.distanceTo(m.position),
          )[0],
        contest = radarCountermeasureContest({
          targetRcs: target.radarCrossSection,
          targetRange: result.targetRange,
          decoyRcs: nearest?.rcs,
          decoyRange: nearest?.position.distanceTo(m.position),
          ecmEnabled: cm.ecmEnabled,
          ecmStrength: cm.ecmStrength,
          ecmHealth: cm.ecmHealth,
          burnThroughRange: cm.burnThroughRange,
        });
      if (roll(this.serial + m.id.length) < contest.defeatProbability) {
        this.terminateMissile(m, "miss", time);
        this.emit(
          time,
          "countermeasure",
          `${m.definition.name} SOFT KILL / ${nearest ? "ECM + DECOY" : "ECM"} / PK ${Math.round(contest.defeatProbability * 100)}%`,
        );
        return;
      }
      this.emit(
        time,
        "countermeasure",
        `${m.definition.name} ${result.targetRange <= cm.burnThroughRange ? "BURN THROUGH" : nearest ? "DECOY REJECTED" : "ECM CONTESTED"}`,
      );
    }
    if (result.targetRange <= m.definition.proximityRadius) {
      target.applyDamage(m.definition.damage, m.position);
      this.standardDamageApplications++;
      this.terminateMissile(m, "hit", time);
      this.emit(time, "hit", `${m.definition.name} HIT / ${target.id}`);
    }
  }
  private applyAircraftDamage(
    a: AirPlatformInstance,
    damage: number,
    point: THREE.Vector3,
    time: number,
  ) {
    const localHit = a.model.worldToLocal(point.clone()),
      resolution = resolveAircraftHit({
        localHit,
        modelLength: Number(a.model.userData.modelLength ?? 8),
        damage,
      }),
      primaryBefore = a.subsystemHealth.get(resolution.primary) ?? 100;
    a.subsystemHealth.set(
      resolution.primary,
      Math.max(0, primaryBefore - resolution.primaryDamage),
    );
    if (resolution.structureDamage > 0)
      a.subsystemHealth.set(
        "structure",
        Math.max(
          0,
          (a.subsystemHealth.get("structure") ?? 100) -
            resolution.structureDamage,
        ),
      );
    this.emit(
      time,
      "damage",
      `${a.definition.name} ${resolution.zone.toUpperCase()} / ${resolution.primary.toUpperCase()} ${Math.round(a.subsystemHealth.get(resolution.primary) ?? 0)}% / STRUCTURE ${Math.round(a.subsystemHealth.get("structure") ?? 0)}%`,
    );
    const disposition = airDamageDisposition({
      structure: a.subsystemHealth.get("structure") ?? 0,
      leftEngine: a.subsystemHealth.get("left-engine") ?? 0,
      rightEngine: a.subsystemHealth.get("right-engine") ?? 0,
      radar: a.subsystemHealth.get("radar") ?? 0,
      flightControl: a.subsystemHealth.get("flight-control") ?? 0,
      weapons: a.subsystemHealth.get("weapons") ?? 0,
    });
    if (disposition === "mission-kill") {
      a.alive = false;
      a.state = "disabled";
      this.emit(
        time,
        "kill",
        `${a.definition.name} MISSION KILL / LOSS OF CONTROL`,
      );
    } else if (disposition === "egress" && a.mission !== "return") {
      a.mission = "return";
      a.state = "egress";
      this.emit(time, "maneuver", `${a.definition.name} DAMAGE ABORT / RETURN`);
    }
  }
  private updateDecoys(dt: number) {
    for (const d of this.decoys) {
      if (!d.alive) continue;
      d.age += dt;
      d.position.addScaledVector(d.velocity, dt);
      d.velocity.multiplyScalar(Math.max(0, 1 - dt * 0.12));
      d.velocity.y -= dt * 0.05;
      const opacity = Math.max(0, 0.85 * (1 - d.age / d.life));
      d.model.traverse((object) => {
        if (object instanceof THREE.Mesh)
          (object.material as THREE.MeshBasicMaterial).opacity = opacity;
      });
      d.model.scale.setScalar(
        1 + d.age * (d.decoyType === "chaff" ? 0.32 : 0.06),
      );
      if (d.age >= d.life) {
        d.alive = false;
        d.model.visible = false;
      }
    }
  }
  diagnostics() {
    const live = this.aircraft.filter((a) => a.alive),
      ksr = this.missiles.filter((m) => m.definition.id === "KSR-5");
    return {
      aircraft: this.aircraft.length,
      live: live.length,
      blueLive: live.filter((a) => a.side === "blue").length,
      redLive: live.filter((a) => a.side === "red").length,
      missiles: this.missiles.length,
      activeMissiles: this.missiles.filter((m) => m.alive).length,
      chaff: this.decoys.filter((d) => d.alive && d.decoyType === "chaff")
        .length,
      flares: this.decoys.filter((d) => d.alive && d.decoyType === "flare")
        .length,
      missileWarnings: this.aircraft.reduce(
        (sum, a) => sum + a.missileWarnings.size,
        0,
      ),
      ecmDetections: this.events.filter(
        (e) => e.kind === "detect" && e.text.includes(" / ECM"),
      ).length,
      launches: this.events.filter((e) => e.kind === "launch").length,
      hits: this.events.filter((e) => e.kind === "hit").length,
      kills: this.events.filter((e) => e.kind === "kill").length,
      standardDamageApplications: this.standardDamageApplications,
      ksrMaximumSpeed: Math.max(0, ...ksr.map((m) => m.velocity.length())),
      advancedFlightUpdates: this.aircraft.reduce(
        (sum, aircraft) => sum + aircraft.advancedFlightState.updateCount,
        0,
      ),
      advancedFlightStates: this.aircraft.map((aircraft) => ({
        id: aircraft.id,
        angleOfAttackDeg: aircraft.advancedFlightState.angleOfAttackDeg,
        loadFactor: aircraft.advancedFlightState.loadFactor,
        dynamicPressure: aircraft.advancedFlightState.dynamicPressure,
        specificEnergy: aircraft.advancedFlightState.specificEnergy,
        specificExcessPower: aircraft.advancedFlightState.specificExcessPower,
        externalStoresMassKg:
          aircraft.advancedFlightState.externalStoresMassKg,
        grossMassRatio: aircraft.advancedFlightState.grossMassRatio,
        effectiveStallSpeed:
          aircraft.advancedFlightState.effectiveStallSpeed,
        thrustAcceleration:
          aircraft.advancedFlightState.thrustAcceleration,
        parasiteDragAcceleration:
          aircraft.advancedFlightState.parasiteDragAcceleration,
        inducedDragAcceleration:
          aircraft.advancedFlightState.inducedDragAcceleration,
        stalled: aircraft.advancedFlightState.stalled,
        controlMode: aircraft.advancedFlightState.controlMode,
        updates: aircraft.advancedFlightState.updateCount,
      })),
      tacticalStates: this.aircraft.map((aircraft) => ({
        id: aircraft.id,
        mode: aircraft.tacticalState.mode,
        supportedWeaponId: aircraft.tacticalState.supportedWeaponId,
        launchZone: aircraft.tacticalState.lastLaunchZone,
        formationRole: aircraft.tacticalState.formationRole,
        formationCommandSlot: aircraft.tacticalState.formationCommandSlot,
        formationTrackNumber: aircraft.tacticalState.formationTrackNumber,
        threatPhase: aircraft.tacticalState.threatPhase,
        actualTurnRateDeg: Number(aircraft.model.userData.actualTurnRateDeg ?? 0),
        maximumTurnRateDeg: Number(aircraft.model.userData.maximumTurnRateDeg ?? 0),
        threatBeamRadialDot: Number(
          aircraft.model.userData.threatBeamRadialDot ?? 1,
        ),
        minimumThreatBeamRadialDot: Number(
          aircraft.model.userData.minimumThreatBeamRadialDot ?? 1,
        ),
        bfmShotWindowSeconds: aircraft.tacticalState.bfmShotWindowSeconds,
      })),
      perceptionUpdates: this.aircraft.reduce(
        (sum, aircraft) => sum + aircraft.pilotPerception.updateCount,
        0,
      ),
      perceivedContacts: this.aircraft.map((aircraft) => ({
        id: aircraft.id,
        contacts: [...aircraft.pilotPerception.contacts.values()].map(
          (contact) => ({
            trackNumber: contact.trackNumber,
            source: contact.source,
            classification: contact.classification,
            quality: contact.quality,
            uncertainty: contact.uncertainty,
            weaponAuthorization: contact.weaponAuthorization,
          }),
        ),
      })),
      missionPlanningUpdates: this.aircraft.reduce(
        (sum, aircraft) => sum + aircraft.missionPlanningState.updates,
        0,
      ),
      missionPlanningStates: this.aircraft.map((aircraft) => ({
        id: aircraft.id,
        assignedMission: aircraft.missionPlanningState.assignedMission,
        order: aircraft.mission,
        phase: aircraft.missionPlanningState.phase,
        reason: aircraft.missionPlanningState.reason,
        updates: aircraft.missionPlanningState.updates,
      })),
      pilotUpdates: this.aircraft.reduce(
        (sum, aircraft) => sum + aircraft.pilotState.updates,
        0,
      ),
      pilotStates: this.aircraft.map((aircraft) => ({
        id: aircraft.id,
        skill: aircraft.pilotSkill,
        stress: aircraft.pilotState.stress,
        fatigue: aircraft.pilotState.fatigue,
        taskSaturation: aircraft.pilotState.taskSaturation,
        gToleranceAvailable: aircraft.pilotState.gToleranceAvailable,
        reactionRemaining: aircraft.pilotState.threatReactionRemaining,
        controlPrecision: aircraft.pilotState.effectiveControlPrecision,
        updates: aircraft.pilotState.updates,
      })),
    };
  }
  visualDiagnostics() {
    return {
      smoking: this.aircraft.filter(
        (a) =>
          (a.model.userData.damageSmoke as THREE.Object3D | undefined)?.visible,
      ).length,
      burning: this.aircraft.filter(
        (a) =>
          (a.model.userData.damageFire as THREE.Object3D | undefined)?.visible,
      ).length,
      crashed: this.aircraft.filter((a) => a.state === "crashed").length,
    };
  }
  hasActiveCombat() {
    return (
      this.missiles.some((m) => m.alive) ||
      this.aircraft.some(
        (a) => a.alive && a.state !== "egress" && a.mission !== "return",
      )
    );
  }
  focusTarget() {
    return (
      this.missiles.find((m) => m.alive)?.model ??
      this.aircraft.find((a) => a.alive)?.model ??
      null
    );
  }
}
