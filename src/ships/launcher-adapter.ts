import * as THREE from "three";
import type {
  DefenseTarget,
  Interceptor,
  LauncherRequest,
  Mk10LauncherState,
  VlsBankState,
  VlsCellState,
} from "../combat-types.js";
import {
  reserveLauncherResource,
  resetMk10LauncherRuntime,
  resetVlsRuntime,
  updateMk10LauncherRuntime,
  updateVlsRuntime,
} from "../ship-defense/launcher-runtime.js";
import { reportForceWeaponsAway } from "../fleet/engagement-runtime.js";
import type { NavalForceRuntime } from "../fleet/types.js";
import type { ShipCombatantInstance } from "./types.js";
import {
  cancelShipLaunchOrder,
  executeShipDefenseAssignment,
  type ShipLaunchOrder,
} from "./weapon-runtime.js";

function vlsCellDistance(left: number, right: number, columns: number) {
  if (left < 0 || right < 0) return Number.POSITIVE_INFINITY;
  const leftRow = Math.floor(left / columns), rightRow = Math.floor(right / columns);
  return Math.max(Math.abs(leftRow - rightRow), Math.abs(left % columns - right % columns));
}

export interface ShipPhysicalLaunch {
  ship: ShipCombatantInstance;
  order: ShipLaunchOrder;
  target: DefenseTarget;
  launcherLabel: string;
  launchPoint: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
}

export interface ShipLauncherAdapterOptions {
  force: NavalForceRuntime;
  ship: ShipCombatantInstance;
  resolveTarget: (localTrackId: string) => DefenseTarget | undefined;
  launch: (event: ShipPhysicalLaunch) => Interceptor;
  launchEffect: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
  log: (message: string) => void;
}

function makeMk10State(name: "AFT" | "FORWARD", model: THREE.Group): Mk10LauncherState {
  const rounds = (model.userData.arms as THREE.Group[]).map(
    (arm) => arm.getObjectByName("readyRound") as THREE.Group,
  );
  rounds.forEach((round) => {
    round.userData.homePosition = round.position.clone();
    round.userData.homeScale = round.scale.clone();
  });
  return {
    name,
    model,
    stowAzimuth: Math.PI,
    phase: "ready",
    phaseSince: 0,
    pending: null,
    azimuth: Math.PI,
    elevation: 0,
    railIndex: 0,
    reloadRail: 0,
    rounds,
  };
}

function newBank(): VlsBankState {
  return {
    lastLaunchAt: Number.NEGATIVE_INFINITY,
    lastCellIndex: -1,
    minimumObservedGap: Number.POSITIVE_INFINITY,
    launchHistory: [],
    damageCenters: [],
    trappedRounds: 0,
  };
}

export class ShipLauncherAdapter {
  private cycle = 0;
  private orders = new WeakMap<LauncherRequest, ShipLaunchOrder>();
  private readonly mk10Launchers: Mk10LauncherState[] = [];
  private readonly vlsCells: VlsCellState[] = [];
  private readonly vlsBanks = { FWD: newBank(), AFT: newBank() };

  constructor(private readonly options: ShipLauncherAdapterOptions) {
    const { ship } = options;
    if (ship.definition.launcher.kind === "mk10") {
      const aft = ship.model.userData.launcher as THREE.Group | undefined;
      const forward = ship.model.userData.forwardLauncher as THREE.Group | undefined;
      if (aft) this.mk10Launchers.push(makeMk10State("AFT", aft));
      if (forward) this.mk10Launchers.push(makeMk10State("FORWARD", forward));
    } else {
      const modelCells = (ship.model.userData.vlsCells ?? []) as Array<{
        lid: THREE.Group;
        origin: THREE.Object3D;
        index: number;
        bank: "FWD" | "AFT";
      }>;
      this.vlsCells.push(...modelCells.map((cell) => ({
        ...cell,
        phase: "ready" as const,
        closeTo: "ready" as const,
        phaseSince: 0,
        pending: null,
        loadout: "OTHER" as const,
      })));
      this.configureVlsLoadout();
    }
  }

  private configureVlsLoadout() {
    const mr = this.options.ship.magazines.rounds.get("SM-2MR") ?? 0;
    const er = this.options.ship.magazines.rounds.get("SM-2ER") ?? 0;
    const ordered = [...this.vlsCells].sort((a, b) => a.index - b.index || a.bank.localeCompare(b.bank));
    for (let index = 0; index < Math.min(mr, ordered.length); index++)
      ordered[index].loadout = "SM-2MR";
    for (let index = mr; index < Math.min(mr + er, ordered.length); index++)
      ordered[index].loadout = "SM-2ER";
  }

  private subsystemHealth(bank: "FWD" | "AFT") {
    return (this.options.ship.subsystemHealth.get(
      bank === "FWD" ? "forwardLauncher" : "aftLauncher",
    ) ?? 0) / 100;
  }

  private reserve(order: ShipLaunchOrder, now: number) {
    const target = this.options.resolveTarget(order.localTrackId);
    if (!target) return { accepted: false };
    const request: LauncherRequest = { target, weapon: order.weapon };
    const result = reserveLauncherResource({
      config: this.options.ship.definition.launcher,
      mk10Launchers: this.mk10Launchers,
      vlsCells: this.vlsCells,
      vlsBanks: this.vlsBanks,
      request,
      elapsed: now,
      cycle: this.cycle,
      health: (bank) => this.subsystemHealth(bank),
      targetId: order.localTrackId,
      cellDistance: (a, b) => this.options.ship.definition.launcher.kind === "mk41"
        ? vlsCellDistance(a, b, this.options.ship.definition.launcher.columns)
        : Number.POSITIVE_INFINITY,
      log: (message) => this.options.log(`${this.options.ship.id} / ${message}`),
    });
    if (!result.accepted) return { accepted: false };
    this.cycle = result.cycle;
    this.orders.set(request, order);
    return {
      accepted: true,
      cancel: () => {
        if (result.cell?.pending === request) {
          result.cell.pending = null;
          result.cell.phase = "closing";
          result.cell.closeTo = "ready";
          result.cell.phaseSince = now;
        }
        if (result.launcher?.pending === request) {
          result.launcher.pending = null;
          result.launcher.phase = "returning";
          result.launcher.reloadRail = -1;
          result.launcher.phaseSince = now;
        }
      },
    };
  }

  executeAssignments(now: number) {
    for (const assignment of this.options.force.assignments.values()) {
      if (assignment.shooterId !== this.options.ship.id || assignment.status !== "assigned") continue;
      executeShipDefenseAssignment({
        force: this.options.force,
        ship: this.options.ship,
        now,
        targetAvailable: (id) => !!this.options.resolveTarget(id),
        reserveLauncher: (order) => this.reserve(order, now),
      }, assignment);
    }
  }

  private cancel(request: LauncherRequest, now: number) {
    const order = this.orders.get(request);
    if (!order) return;
    cancelShipLaunchOrder(this.options.ship, order, now);
  }

  private depart(
    request: LauncherRequest,
    launcherLabel: string,
    launchPoint: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    now: number,
  ) {
    const order = this.orders.get(request);
    if (!order) throw new Error(`${this.options.ship.id} launcher departed without owned order`);
    const target = this.options.resolveTarget(order.localTrackId);
    if (!target) throw new Error(`${this.options.ship.id} departed after target adapter was lost`);
    const interceptor = this.options.launch({
      ship: this.options.ship,
      order,
      target,
      launcherLabel,
      launchPoint,
      origin,
      direction,
    });
    reportForceWeaponsAway(this.options.force, {
      assignmentId: order.assignmentId,
      shooterId: this.options.ship.id,
      count: 1,
      estimatedSingleShotPk: 0.55,
      expectedInterceptTimes: [now + Math.max(2, order.track.position.distanceTo(origin) / 10)],
      now,
    });
    return interceptor;
  }

  update(now: number, dt: number) {
    const { ship } = this.options;
    if (ship.definition.launcher.kind === "mk10") {
      updateMk10LauncherRuntime({
        config: ship.definition.launcher,
        launchers: this.mk10Launchers,
        elapsed: now,
        dt,
        health: (launcher) => this.subsystemHealth(launcher.name === "AFT" ? "AFT" : "FWD"),
        trackPosition: (request) => {
          const order = this.orders.get(request);
          const track = order ? ship.localTracks.get(order.localTrackId) : undefined;
          return track && now - track.updatedAt <= 2.2 ? track.position : null;
        },
        worldToLocal: (position) => ship.model.worldToLocal(position),
        returnAmmo: () => undefined,
        cancel: (request) => this.cancel(request, now),
        launch: (request, label, point, origin, direction) =>
          this.depart(request, label, point, origin, direction, now),
        log: (message) => this.options.log(`${ship.id} / ${message}`),
      });
      return;
    }
    updateVlsRuntime({
      config: ship.definition.launcher,
      cells: this.vlsCells,
      banks: this.vlsBanks,
      elapsed: now,
      dt,
      health: (bank) => this.subsystemHealth(bank),
      shipQuaternion: () => ship.model.getWorldQuaternion(new THREE.Quaternion()),
      returnAmmo: () => undefined,
      cancel: (request) => this.cancel(request, now),
      launch: (request, label, point, origin, direction) =>
        this.depart(request, label, point, origin, direction, now),
      launchEffect: this.options.launchEffect,
      log: (message) => this.options.log(`${ship.id} / ${message}`),
    });
  }

  diagnostics() {
    return {
      pending: this.mk10Launchers.filter((launcher) => launcher.pending).length
        + this.vlsCells.filter((cell) => cell.pending).length,
      vls: this.vlsCells.map((cell) => `${cell.bank}:${cell.index + 1}:${cell.phase}`).join("|"),
    };
  }

  reset() {
    this.cycle = 0;
    this.orders = new WeakMap();
    if (this.options.ship.definition.launcher.kind === "mk10") {
      resetMk10LauncherRuntime(this.mk10Launchers);
      return;
    }
    resetVlsRuntime(this.vlsCells, this.vlsBanks);
    for (const cell of this.vlsCells) cell.loadout = "OTHER";
    this.configureVlsLoadout();
  }
}
