import * as THREE from "three";
import type { DefenseTarget } from "../combat-types.js";
import { deterministicProbabilityRoll } from "../probability.js";
import { sourceSeed } from "../ship-defense/defense-targets.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "./types.js";

export interface ShipCiwsTargetProfile {
  pkPenalty: number;
  pkCap?: number;
}

export interface ShipCiwsUpdateContext {
  resolveTarget: (targetId: string) => DefenseTarget | undefined;
  resolveHit: (target: DefenseTarget, damage: number) => boolean;
  targetProfile?: (target: DefenseTarget) => ShipCiwsTargetProfile;
  createTracer?: (target: THREE.Vector3, origin: THREE.Vector3) => void;
  log?: (message: string) => void;
}

export interface ShipCiwsEvent {
  shipId: string;
  targetId: string;
  mount: string;
  rounds: number;
  pk: number;
  result: "kill" | "miss";
}

interface Candidate {
  track: ShipTrackEstimate;
  target: DefenseTarget;
  range: number;
  closingSpeed: number;
  tti: number;
  mount: NonNullable<ShipCombatantInstance["definition"]["ciws"]>["mounts"][number];
  mountModel: THREE.Object3D;
  bearing: number;
}

export class ShipCiwsRuntime {
  private readonly lastShotAt = new Map<string, number>();
  private readonly events: ShipCiwsEvent[] = [];

  update(ship: ShipCombatantInstance, now: number, dt: number, context: ShipCiwsUpdateContext) {
    const definition = ship.definition.ciws;
    const health = (ship.subsystemHealth.get("ciws") ?? 0) / 100;
    if (!definition || !ship.alive || health <= 0.05 || ship.magazines.ciws <= 0) return;

    const candidates = [...ship.localTracks.values()]
      .filter((track) => track.source === "local-radar" && track.classification === "missile"
        && track.quality >= 0.2 && now - track.updatedAt <= 2.5)
      .flatMap((track): Candidate[] => {
        const target = context.resolveTarget(track.targetId);
        if (!target || target.phase === "destroyed" || target.entity?.kind !== "missile" || !target.entity.alive) return [];
        const relative = track.position.clone().sub(ship.position);
        const range = relative.length();
        if (range > definition.maximumRange || range < 0.001) return [];
        const closingSpeed = -track.velocity.dot(relative.clone().normalize());
        if (closingSpeed < definition.minimumClosingSpeed) return [];
        const local = ship.model.worldToLocal(track.position.clone());
        const bearing = Math.atan2(local.x, local.z);
        const mounts = definition.mounts
          .flatMap((mount) => {
            const mountModel = ship.model.getObjectByName(mount.objectName);
            if (!mountModel) return [];
            const center = THREE.MathUtils.degToRad(mount.centerBearingDeg);
            const delta = Math.abs(Math.atan2(Math.sin(bearing - center), Math.cos(bearing - center)));
            return delta <= THREE.MathUtils.degToRad(mount.arcDeg / 2)
              ? [{ mount, mountModel, delta }]
              : [];
          })
          .sort((left, right) => left.delta - right.delta);
        if (!mounts.length) return [];
        return [{ track, target, range, closingSpeed, tti: range / closingSpeed,
          mount: mounts[0].mount, mountModel: mounts[0].mountModel, bearing }];
      })
      .sort((left, right) => left.tti - right.tti);
    const candidate = candidates[0];
    if (!candidate || candidate.tti < definition.minimumTti) return;

    const localAim = candidate.mountModel.parent
      ?.worldToLocal(candidate.track.position.clone())
      .sub(candidate.mountModel.position);
    const desiredTraverse = localAim ? Math.atan2(-localAim.z, localAim.x) : 0;
    const traverseError = Math.atan2(
      Math.sin(desiredTraverse - candidate.mountModel.rotation.y),
      Math.cos(desiredTraverse - candidate.mountModel.rotation.y),
    );
    candidate.mountModel.rotation.y += THREE.MathUtils.clamp(
      traverseError,
      -THREE.MathUtils.degToRad(definition.traverseRateDeg) * dt * health,
      THREE.MathUtils.degToRad(definition.traverseRateDeg) * dt * health,
    );
    if (Math.abs(traverseError) > THREE.MathUtils.degToRad(definition.firingToleranceDeg)) return;
    const lastShotAt = this.lastShotAt.get(ship.id) ?? Number.NEGATIVE_INFINITY;
    if (now - lastShotAt < definition.cooldownSeconds / Math.max(0.4, health)) return;
    this.lastShotAt.set(ship.id, now);

    const rounds = Math.min(definition.burstRounds, ship.magazines.ciws);
    ship.magazines.ciws -= rounds;
    const origin = new THREE.Vector3();
    candidate.mountModel.getWorldPosition(origin);
    origin.y += 1.2;
    context.createTracer?.(candidate.track.position, origin);
    const profile = context.targetProfile?.(candidate.target) ?? { pkPenalty: 0 };
    const saturation = Math.max(1, candidates.filter((entry) => entry.range <= definition.maximumRange).length);
    const trackFactor = THREE.MathUtils.clamp(
      candidate.track.quality - candidate.track.uncertainty / Math.max(1, definition.maximumRange * 10),
      0.25,
      1,
    );
    let pk = Math.max(0.03, definition.basePk / saturation - profile.pkPenalty)
      * (0.25 + 0.75 * health) * (0.55 + 0.45 * trackFactor);
    if (profile.pkCap !== undefined) pk = Math.min(profile.pkCap, pk);
    pk = Math.min(definition.maximumPk, pk);
    const roll = deterministicProbabilityRoll(sourceSeed(candidate.track.targetId), now, ship.magazines.ciws);
    const destroyed = roll < pk && context.resolveHit(candidate.target, definition.damage);
    const result = destroyed ? "kill" : "miss";
    this.events.push({ shipId: ship.id, targetId: candidate.track.targetId,
      mount: candidate.mount.label, rounds, pk, result });
    context.log?.(`${ship.id} CIWS ${result.toUpperCase()} / ${candidate.mount.label} / ${candidate.track.targetId} / PK ${Math.round(pk * 100)}% / ${ship.magazines.ciws} ROUNDS`);
  }

  diagnostics() { return [...this.events]; }
  reset() {
    this.lastShotAt.clear();
    this.events.length = 0;
  }
}
