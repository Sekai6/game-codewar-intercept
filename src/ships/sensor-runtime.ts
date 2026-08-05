import * as THREE from "three";
import { CombatPicture } from "../sim.js";
import type { TargetableEntity } from "../combat-entity.js";
import type { ShipCombatantInstance, ShipTrackEstimate } from "./types.js";

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
      return;
    }
    const primary = ship.definition.sensors.find((sensor) => sensor.threeDimensional);
    const secondary = ship.definition.sensors.find((sensor) => !sensor.threeDimensional);
    picture.update(
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
    for (const track of picture.tracks.values()) {
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
  }

  reset() {
    for (const picture of this.pictures.values()) picture.reset();
  }
}
