import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity.js";
import type { DefenseTarget, Interceptor } from "../combat-types.js";
import type { ShipDefinition, ShipWeapon, SubsystemId } from "../ship-types.js";
import type { ShipCombatantInstance } from "../ships/types.js";
import { ShipSensorRuntime, type ShipSensorObservation } from "../ships/sensor-runtime.js";
import { reassessFleetCommand } from "./command-runtime.js";
import { FleetAirDefenseCoordinator } from "./air-defense-coordinator.js";
import { createNavalForceRuntime } from "./force-runtime.js";
import { updateFleetFormation } from "./formation-runtime.js";
import { FleetLink11Runtime } from "./link11-runtime.js";
import { updateForceEngagements } from "./engagement-runtime.js";
import { observeFleet, type FleetObservation } from "./observability.js";
import { ShipLauncherAdapter, type ShipPhysicalLaunch } from "../ships/launcher-adapter.js";
import type { NavalForceRuntime, NavalForceScenario } from "./types.js";

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
}

export class FleetSceneIntegration {
  readonly force: NavalForceRuntime;
  readonly flagshipId: string;
  private readonly externalShips: ReadonlySet<string>;
  private readonly companions: ShipCombatantInstance[];
  private readonly sensors = new ShipSensorRuntime();
  private readonly link11 = new FleetLink11Runtime();
  private readonly airDefense = new FleetAirDefenseCoordinator();
  private readonly launchers: ShipLauncherAdapter[] = [];

  constructor(private readonly options: FleetSceneIntegrationOptions) {
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
    for (const ship of this.companions) {
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
          launch: options.launchInterceptor,
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
    this.syncFlagship();
    reassessFleetCommand(this.force, now);
    updateFleetFormation({
      force: this.force,
      dt,
      externallyIntegratedShipIds: this.externalShips,
    });
    for (const launcher of this.launchers) launcher.update(now, dt);
  }

  updateSensors(now: number, dt: number, observations: readonly ShipSensorObservation[]) {
    for (const ship of this.force.ships.values()) this.sensors.update(ship, now, dt, observations);
  }

  updateNetwork(now: number, enabled: boolean) {
    this.link11.update(this.force, now, enabled);
  }

  updateAirDefense(now: number) {
    updateForceEngagements(this.force, now);
    this.airDefense.update(this.force, now);
    for (const launcher of this.launchers) launcher.executeAssignments(now);
  }

  networkDiagnostics() { return this.link11.diagnostics(); }
  isLink11Enabled() { return this.link11.isEnabled(); }
  networkActivities(now: number) { return this.link11.activities(now); }
  observation(now: number): FleetObservation {
    return observeFleet(this.force, now, this.isLink11Enabled(), this.networkActivities(now));
  }
  launcherDiagnostics() { return this.launchers.map((launcher) => launcher.diagnostics()); }

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
      const [stationX, stationY, stationZ] = entry.station;
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
    }
    this.force.formationState.anchorShipId = this.flagshipId;
    this.force.formationState.stations.clear();
    this.force.formationState.lastCommandReassessmentAt = Number.NEGATIVE_INFINITY;
    this.sensors.reset();
    this.link11.reset(this.force);
    this.airDefense.reset(this.force);
    for (const launcher of this.launchers) launcher.reset();
  }

  dispose() {
    for (const ship of this.companions) this.options.scene.remove(ship.model);
  }
}
