import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity.js";
import type { DefenseTarget, Interceptor } from "../combat-types.js";
import type { ShipDefinition, ShipWeapon, SubsystemId } from "../ship-types.js";
import type { ShipCombatantInstance } from "../ships/types.js";
import { ShipSensorRuntime, type ShipSensorObservation } from "../ships/sensor-runtime.js";
import { reassessFleetCommand } from "./command-runtime.js";
import { FleetAirDefenseCoordinator } from "./air-defense-coordinator.js";
import { FleetSurfaceWarfareCoordinator } from "./surface-warfare-coordinator.js";
import { createNavalForceRuntime } from "./force-runtime.js";
import { updateFleetFormation } from "./formation-runtime.js";
import { FleetLink11Runtime } from "./link11-runtime.js";
import { updateForceEngagements } from "./engagement-runtime.js";
import { observeFleet, type FleetObservation } from "./observability.js";
import { ShipLauncherAdapter, type ShipPhysicalLaunch } from "../ships/launcher-adapter.js";
import { ShipElectronicWarfareRuntime, type ShipCountermeasureSnapshot } from "../ships/electronic-warfare-runtime.js";
import { ShipCiwsRuntime, type ShipCiwsTargetProfile } from "../ships/ciws-runtime.js";
import { ShipDamageControlRuntime } from "../ships/damage-control-runtime.js";
import { FleetElectronicWarfareVisuals } from "./electronic-warfare-visuals.js";
import { FleetDamageVisuals } from "./damage-visuals.js";
import { FleetLaunchObservability } from "./launch-observability.js";
import type { NavalForceRuntime, NavalForceScenario } from "./types.js";
import type { SpaceWeatherSnapshot } from "../space-weather/types.js";

export interface LegacyFlagshipSnapshot {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  speedKnots: number;
  commandedSpeedKnots: number;
  hullIntegrity: number;
  subsystemHealth: ReadonlyMap<SubsystemId, number>;
  magazines: ReadonlyMap<ShipWeapon, number>;
}

export interface FleetSceneIntegrationOptions {
  scene: THREE.Scene;
  scenario: NavalForceScenario;
  definitions: ReadonlyMap<string, ShipDefinition>;
  flagshipModel: THREE.Group;
  flagshipSnapshot: () => LegacyFlagshipSnapshot;
  applyFlagshipDamage: (damage: number, hitPoint: THREE.Vector3) => void;
  registerModel?: (model: THREE.Group) => void;
  resolveDefenseTarget?: (localTrackId: string) => DefenseTarget | undefined;
  launchInterceptor?: (event: ShipPhysicalLaunch) => Interceptor;
  launchEffect?: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
  log?: (message: string) => void;
  resolveCiwsHit?: (target: DefenseTarget, damage: number) => boolean;
  ciwsTargetProfile?: (target: DefenseTarget) => ShipCiwsTargetProfile;
  createCiwsTracer?: (target: THREE.Vector3, origin: THREE.Vector3) => void;
}

export class FleetSceneIntegration {
  readonly force: NavalForceRuntime;
  readonly flagshipId: string;
  private readonly externalShips: ReadonlySet<string>;
  private readonly companions: ShipCombatantInstance[];
  private readonly sensors = new ShipSensorRuntime();
  private readonly link11 = new FleetLink11Runtime();
  private readonly airDefense = new FleetAirDefenseCoordinator();
  private readonly surfaceWarfare = new FleetSurfaceWarfareCoordinator();
  private readonly launchers: ShipLauncherAdapter[] = [];
  private readonly electronicWarfare = new ShipElectronicWarfareRuntime();
  private readonly electronicWarfareVisuals: FleetElectronicWarfareVisuals;
  private readonly damageVisuals = new FleetDamageVisuals();
  private readonly ciws = new ShipCiwsRuntime();
  private readonly damageControl = new ShipDamageControlRuntime();
  readonly launchObservability = new FleetLaunchObservability();
  private currentTime = 0;
  private ciwsEnabled = true;
  private readonly scenarioRoutes = new Map<string, { points: readonly THREE.Vector3[]; loop: boolean; index: number }>();

  constructor(private readonly options: FleetSceneIntegrationOptions) {
    this.electronicWarfareVisuals = new FleetElectronicWarfareVisuals(options.scene);
    const scenarioOtc = options.scenario.ships.find((entry) => entry.commandRoles.includes("otc"));
    if (!scenarioOtc) throw new Error(`Fleet ${options.scenario.id} has no OTC model owner`);
    this.force = createNavalForceRuntime(
      options.scenario,
      options.definitions,
      new Map([[scenarioOtc.instanceId, options.flagshipModel]]),
    );
    this.flagshipId = this.force.commandRoles.get("otc")!;
    this.externalShips = new Set([this.flagshipId]);
    const flagship = this.force.ships.get(this.flagshipId)!;
    flagship.applyDamage = options.applyFlagshipDamage;
    this.companions = [...this.force.ships.values()].filter((ship) => ship.id !== this.flagshipId);
    for (const entry of options.scenario.ships) if (entry.scenarioRoute?.length) {
      this.scenarioRoutes.set(entry.instanceId, {
        points:entry.scenarioRoute.map((point) => new THREE.Vector3(...point)),
        loop:entry.scenarioRouteLoop ?? false,
        index:0,
      });
    }
    for (const ship of this.companions) {
      ship.applyDamage = (damage, hitPoint) => this.damageControl.applyImpact(ship, damage, hitPoint, this.currentTime);
      ship.model.userData.fleetShipId = ship.id;
      ship.model.userData.fleetRole = this.force.formationRoles.get(ship.id);
      ship.model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      options.registerModel?.(ship.model);
      options.scene.add(ship.model);
      if (options.resolveDefenseTarget && options.launchInterceptor && options.launchEffect) {
        this.launchers.push(new ShipLauncherAdapter({
          force: this.force,
          ship,
          resolveTarget: options.resolveDefenseTarget,
          launch: (event) => {
            this.launchObservability.record(event, this.currentTime);
            return options.launchInterceptor!(event);
          },
          launchEffect: options.launchEffect,
          log: options.log ?? (() => undefined),
        }));
      }
    }
    this.syncFlagship();
  }

  private syncFlagship() {
    const state = this.options.flagshipSnapshot();
    const flagship = this.force.ships.get(this.flagshipId)!;
    flagship.velocity.copy(state.velocity);
    flagship.heading = state.heading;
    flagship.speedKnots = state.speedKnots;
    flagship.commandedSpeedKnots = state.commandedSpeedKnots;
    flagship.hullIntegrity = state.hullIntegrity;
    flagship.alive = state.hullIntegrity > 0;
    for (const [id, health] of state.subsystemHealth) flagship.subsystemHealth.set(id, health);
    for (const [weapon, rounds] of state.magazines) flagship.magazines.rounds.set(weapon, rounds);
  }

  update(now: number, dt: number) {
    this.currentTime = now;
    this.syncFlagship();
    reassessFleetCommand(this.force, now);
    this.surfaceWarfare.update(this.force, now);
    const independentlyRouted = new Set([...this.externalShips, ...this.scenarioRoutes.keys()]);
    updateFleetFormation({
      force: this.force,
      dt,
      externallyIntegratedShipIds: independentlyRouted,
    });
    for (const [shipId, route] of this.scenarioRoutes) {
      if (this.externalShips.has(shipId)) continue;
      const ship = this.force.ships.get(shipId);
      if (!ship?.alive || !route.points.length) continue;
      let waypoint = route.points[Math.min(route.index, route.points.length - 1)];
      if (ship.position.distanceTo(waypoint) < 18) {
        if (route.index < route.points.length - 1) route.index++;
        else if (route.loop) route.index = 0;
        waypoint = route.points[route.index];
      }
      const offset = waypoint.clone().sub(ship.position);
      if (offset.lengthSq() > 1) {
        const desiredHeading = Math.atan2(-offset.z, offset.x);
        const turn = THREE.MathUtils.degToRad(ship.definition.platform.turnRateDeg) * dt;
        const error = Math.atan2(Math.sin(desiredHeading - ship.heading), Math.cos(desiredHeading - ship.heading));
        ship.heading += THREE.MathUtils.clamp(error, -turn, turn);
      }
      ship.commandedSpeedKnots = Math.min(ship.definition.platform.maxSpeedKnots, Math.max(0, ship.commandedSpeedKnots));
      const speedDelta = ship.commandedSpeedKnots - ship.speedKnots;
      const rate = speedDelta >= 0 ? ship.definition.platform.accelerationKnotsPerSecond : ship.definition.platform.decelerationKnotsPerSecond;
      ship.speedKnots += THREE.MathUtils.clamp(speedDelta, -rate * dt, rate * dt);
      ship.velocity.set(Math.cos(ship.heading), 0, -Math.sin(ship.heading)).multiplyScalar(ship.speedKnots * .005144);
      ship.position.addScaledVector(ship.velocity, dt);
      ship.model.rotation.y = ship.heading;
    }
    for (const ship of this.force.ships.values()) {
      if (!this.externalShips.has(ship.id)) this.damageControl.update(ship, now, dt);
      this.electronicWarfare.update(ship, dt);
    }
    this.electronicWarfareVisuals.update(
      [...this.force.ships.values()].flatMap((ship) => ship.electronicWarfare.decoys),
    );
    this.damageVisuals.update(this.companions, now);
    for (const launcher of this.launchers) launcher.update(now, dt);
  }

  updateSensors(now: number, dt: number, observations: readonly ShipSensorObservation[]) {
    for (const ship of this.force.ships.values()) this.sensors.update(ship, now, dt, observations);
  }

  updateNetwork(now: number, enabled: boolean) {
    this.link11.update(this.force, now, enabled);
  }

  setSpaceWeather(snapshot: SpaceWeatherSnapshot | null) {
    this.link11.setPropagationSnapshot(snapshot);
  }

  updateAirDefense(now: number, dt: number) {
    updateForceEngagements(this.force, now);
    this.airDefense.update(this.force, now);
    for (const launcher of this.launchers) launcher.executeAssignments(now);
    if (this.ciwsEnabled && this.options.resolveDefenseTarget && this.options.resolveCiwsHit) {
      for (const ship of this.companions) this.ciws.update(ship, now, dt, {
        resolveTarget: (targetId) => this.options.resolveDefenseTarget?.(targetId),
        resolveHit: this.options.resolveCiwsHit,
        targetProfile: this.options.ciwsTargetProfile,
        createTracer: this.options.createCiwsTracer,
        log: this.options.log,
      });
    }
  }

  networkDiagnostics() { return this.link11.diagnostics(); }
  isLink11Enabled() { return this.link11.isEnabled(); }
  networkActivities(now: number) { return this.link11.activities(now); }
  observation(now: number): FleetObservation {
    const observation = observeFleet(this.force, now, this.isLink11Enabled(), this.networkActivities(now));
    observation.physicalLaunches = this.launchObservability.all().map((event) => ({ ...event }));
    return observation;
  }

  recentPhysicalLaunches(maxAge = 120) {
    return this.launchObservability.recent(maxAge, this.currentTime);
  }
  launcherDiagnostics() { return this.launchers.map((launcher) => launcher.diagnostics()); }

  setElectronicWarfareEnabled(enabled: boolean) {
    for (const ship of this.companions)
      ship.electronicWarfare.ecmEnabled = enabled && Boolean(ship.definition.electronicWarfare);
  }

  setCountermeasuresEnabled(enabled: boolean) {
    for (const ship of this.companions)
      ship.electronicWarfare.decoyEnabled = enabled && Boolean(ship.definition.electronicWarfare);
  }

  countermeasures(targetId: string): ShipCountermeasureSnapshot | null {
    const ship = this.force.ships.get(targetId);
    return ship && !this.externalShips.has(targetId)
      ? this.electronicWarfare.snapshot(ship)
      : null;
  }

  requestCountermeasure(targetId: string, threatPosition: THREE.Vector3, now: number) {
    const ship = this.force.ships.get(targetId);
    if (!ship || this.externalShips.has(targetId)) return false;
    const decoy = this.electronicWarfare.deploy(ship, threatPosition, now);
    if (!decoy) return false;
    this.options.log?.(`${ship.definition.name} SRBOC PHYSICAL RELEASE / ${decoy.id} / ROUNDS ${ship.electronicWarfare.decoyRounds}`);
    return true;
  }

  electronicWarfareDiagnostics() {
    return this.companions.map((ship) => ({
      shipId: ship.id,
      ecmEnabled: ship.electronicWarfare.ecmEnabled,
      decoyEnabled: ship.electronicWarfare.decoyEnabled,
      ecmHealth: (ship.subsystemHealth.get("ecm") ?? 0) / 100,
      rounds: ship.electronicWarfare.decoyRounds,
      activeDecoys: ship.electronicWarfare.decoys.filter((decoy) => decoy.alive).length,
    }));
  }
  ciwsDiagnostics() { return this.ciws.diagnostics(); }
  ciwsCapabilityDiagnostics() {
    return this.companions.map((ship) => ({
      shipId: ship.id,
      physicalMounts: ship.definition.ciws?.mounts
        .filter((mount) => Boolean(ship.model.getObjectByName(mount.objectName))).length ?? 0,
      declaredMounts: ship.definition.ciws?.mounts.length ?? 0,
    }));
  }
  setCiwsEnabled(enabled: boolean) { this.ciwsEnabled = enabled; }
  isCiwsEnabled() { return this.ciwsEnabled; }
  damageDiagnostics() { return this.damageControl.diagnostics(); }
  surfaceWarfareDiagnostics() {
    return [...this.force.surfaceAssignments.values()].map((assignment) => ({ ...assignment }));
  }

  companionTargets(): readonly TargetableEntity[] {
    return this.companions;
  }

  reset() {
    this.force.commandRoles.clear();
    const flagship = this.force.ships.get(this.flagshipId)!;
    for (const entry of this.options.scenario.ships) {
      const ship = this.force.ships.get(entry.instanceId);
      if (!ship) continue;
      for (const role of entry.commandRoles) this.force.commandRoles.set(role, ship.id);
      if (ship.id === this.flagshipId) continue;
      const [stationX, stationY, stationZ] = this.force.stations.get(ship.id)!;
      const sin = Math.sin(flagship.heading), cos = Math.cos(flagship.heading);
      ship.position.set(
        flagship.position.x + stationX * cos + stationZ * sin,
        flagship.position.y + stationY,
        flagship.position.z - stationX * sin + stationZ * cos,
      );
      ship.heading = flagship.heading;
      ship.model.rotation.y = flagship.heading;
      ship.speedKnots = entry.initialSpeedKnots ?? ship.definition.platform.patrolSpeedKnots;
      ship.commandedSpeedKnots = ship.speedKnots;
      ship.hullIntegrity = 100;
      ship.damageControl.fireIntensity = 0;
      ship.damageControl.flooding = 0;
      ship.damageControl.damageControlCapacity = 100;
      ship.damageControl.lastImpactAt = Number.NEGATIVE_INFINITY;
      ship.damageControl.casualtyCount = 0;
      ship.alive = true;
      ship.localTracks.clear();
      ship.networkTracks.clear();
      ship.engagements.clear();
      ship.magazines.rounds.set("RIM-67", entry.loadout?.["RIM-67"] ?? ship.definition.ammo.rim67);
      ship.magazines.rounds.set("SM-2MR", entry.loadout?.["SM-2MR"] ?? ship.definition.ammo.sm2mr);
      ship.magazines.rounds.set("SM-2ER", entry.loadout?.["SM-2ER"] ?? ship.definition.ammo.sm2er);
      ship.magazines.ciws = entry.loadout?.ciws ?? ship.definition.ammo.ciws;
      ship.magazines.surfaceStrike = entry.loadout?.surfaceStrike ?? ship.definition.surfaceStrike?.magazine ?? 0;
      for (const id of ship.subsystemHealth.keys()) ship.subsystemHealth.set(id, 100);
      this.electronicWarfare.reset(ship);
    }
    this.force.formationState.anchorShipId = this.flagshipId;
    this.force.formationState.stations.clear();
    this.force.formationState.lastCommandReassessmentAt = Number.NEGATIVE_INFINITY;
    this.sensors.reset();
    this.link11.reset(this.force);
    this.airDefense.reset(this.force);
    this.surfaceWarfare.reset(this.force);
    this.ciws.reset();
    this.damageControl.reset();
    this.damageVisuals.reset(this.companions);
    this.launchObservability.reset();
    for (const launcher of this.launchers) launcher.reset();
    for (const route of this.scenarioRoutes.values()) route.index = 0;
    this.electronicWarfareVisuals.reset();
  }

  dispose() {
    this.electronicWarfareVisuals.dispose();
    this.damageVisuals.dispose();
    for (const ship of this.companions) this.options.scene.remove(ship.model);
  }
}
