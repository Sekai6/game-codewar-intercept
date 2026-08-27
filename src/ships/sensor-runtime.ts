import * as THREE from "three";
import { CombatPicture } from "../sim.js";
import type { TargetableEntity } from "../combat-entity.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "./types.js";
import { observePassive, fusePassiveTracks, type PassiveObservation } from "../sensors/passive-runtime.js";

export interface ShipSensorObservation {
  entity: TargetableEntity;
  altitudeMeters: number;
}

export class ShipSensorRuntime {
  private readonly pictures = new Map<string, CombatPicture>();

  update(
    ship: ShipCombatantInstance,
    now: number,
    dt: number,
    observations: readonly ShipSensorObservation[],
    localWeather?: (position: THREE.Vector3) => { radarRangeFactor:number; detectionProbabilityFactor:number; measurementNoiseFactor:number },
  ) {
    let picture = this.pictures.get(ship.id);
    if (!picture) {
      picture = new CombatPicture(ship.definition.sensors);
      this.pictures.set(ship.id, picture);
    }
    if (!ship.alive) {
      ship.localTracks.clear();
      ship.passiveTracks.clear();
      return;
    }
    if (now >= ship.nextPassiveScan) {
      const suite = ship.definition.passiveSensors;
      const nextPassive = new Map<string, { irst?: PassiveObservation; esm?: PassiveObservation }>();
      for (const { entity } of observations) {
        if (!entity.alive || entity.side === ship.side || entity.id === ship.id) continue;
        const slot = nextPassive.get(entity.id) ?? {};
        // Deterministic per-scenario noise: passive tracks must be replayable in AAR/Tacview.
        const seed = Math.floor(now * 10) + ship.id.length * 97 + entity.id.length * 193;
        const unit = (n: number) => {
          const x = Math.sin(seed + n * 17.17) * 43758.5453;
          return x - Math.floor(x);
        };
        const noise = [unit(1), unit(2), unit(3)] as const;
        if (suite?.irst) slot.irst = observePassive({ sensor: suite.irst, observer: ship, target: entity, emission: entity.emissionState, time: now, noise });
        if (suite?.esm) slot.esm = observePassive({ sensor: suite.esm, observer: ship, target: entity, emission: entity.emissionState, time: now, noise });
        nextPassive.set(entity.id, slot);
      }
      ship.passiveTracks.clear();
      for (const [id, pair] of nextPassive) {
        const fused = fusePassiveTracks(pair.irst, pair.esm);
        if (fused) ship.passiveTracks.set(id, fused);
      }
      const interval = Math.min(suite?.irst?.updateInterval ?? Infinity, suite?.esm?.updateInterval ?? Infinity);
      ship.nextPassiveScan = now + (Number.isFinite(interval) ? interval : 9999);
    }
    const primary = ship.definition.sensors.find((sensor) => sensor.threeDimensional);
    const secondary = ship.definition.sensors.find((sensor) => !sensor.threeDimensional);
    if (ship.emconMode === "active") picture.update(
      now,
      dt,
      observations
        .filter(({ entity }) => entity.alive && entity.side !== ship.side && entity.id !== ship.id)
        .map(({ entity, altitudeMeters }) => ({
          id: entity.id,
          position: entity.position,
          velocity: entity.velocity,
          altitude: altitudeMeters,
          rcs: entity.radarCrossSection,
          domain: entity.kind === "ship" ? ("surface" as const) : ("air" as const),
        })),
      {
        ...(primary ? { [primary.name]: (ship.subsystemHealth.get("primaryRadar") ?? 0) / 100 } : {}),
        ...(secondary ? { [secondary.name]: (ship.subsystemHealth.get("secondaryRadar") ?? 0) / 100 } : {}),
      },
      ship.position,
      {},
      localWeather ? (() => { const weather=localWeather(ship.position); return {rangeFactor:weather.radarRangeFactor,probabilityFactor:weather.detectionProbabilityFactor,measurementNoiseFactor:weather.measurementNoiseFactor}; })() : {},
    );
    const classifications = new Map(observations.map(({ entity }) => [entity.id, entity.kind]));
    const next = new Map<string, ShipTrackEstimate>();
    for (const track of ship.emconMode === "active" ? picture.tracks.values() : []) {
      const targetId = String(track.sourceId);
      const kind = classifications.get(targetId);
      next.set(targetId, {
        targetId,
        position: track.position.clone(),
        velocity: track.velocity.clone(),
        quality: track.quality,
        uncertainty: track.uncertainty,
        classification: kind === "aircraft" || kind === "ship" || kind === "missile" ? kind : "unknown",
        source: "local-radar",
        updatedAt: track.lastSeen,
        weaponQuality: track.altitudeKnown && track.solutionQuality >= 0.45 && track.age < 2.2,
      });
    }
    ship.localTracks = next;
    for (const [targetId, passive] of ship.passiveTracks) {
      if (now - passive.lastUpdate > 12) { ship.passiveTracks.delete(targetId); continue; }
      if (!next.has(targetId)) next.set(targetId, {
        targetId, position: passive.position.clone(), velocity: passive.velocity.clone(), quality: passive.quality * 0.8,
        uncertainty: passive.uncertainty, classification: passive.classification, source: passive.source === "esm" ? "esm" : "passive-fusion", updatedAt: passive.lastUpdate, weaponQuality: false, passive,
      });
    }
  }

  reset() {
    for (const picture of this.pictures.values()) picture.reset();
  }
}
