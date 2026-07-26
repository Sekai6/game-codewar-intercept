import * as THREE from "three";
import type { NavalForceRuntime } from "./types.js";

const KNOTS_TO_WORLD_UNITS_PER_SECOND = 0.005144;
const ON_STATION_DISTANCE = 12;
const STRAGGLING_DISTANCE = 90;

export interface FormationUpdateInput {
  force: NavalForceRuntime;
  dt: number;
  externallyIntegratedShipIds?: ReadonlySet<string>;
}

function stationWorldPosition(
  anchor: THREE.Vector3,
  heading: number,
  station: readonly [number, number, number],
) {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  return new THREE.Vector3(
    anchor.x + station[0] * cos + station[2] * sin,
    anchor.y + station[1],
    anchor.z - station[0] * sin + station[2] * cos,
  );
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function updateFleetFormation({ force, dt, externallyIntegratedShipIds }: FormationUpdateInput) {
  if (!(dt > 0)) return;
  const anchor = force.ships.get(force.formationState.anchorShipId);
  if (!anchor?.alive) return;

  force.formationState.heading = anchor.heading;
  force.formationState.speedKnots = anchor.speedKnots;
  for (const [shipId, ship] of force.ships) {
    const station = force.stations.get(shipId);
    if (!station) continue;
    const desired = stationWorldPosition(anchor.position, anchor.heading, station);
    const offset = desired.clone().sub(ship.position);
    const errorDistance = offset.length();

    if (!ship.alive) {
      force.formationState.stations.set(shipId, {
        desiredPosition: desired.toArray(), errorDistance, status: "disabled",
      });
      continue;
    }

    if (shipId === anchor.id) {
      ship.commandedSpeedKnots = Math.min(
        ship.definition.platform.maxSpeedKnots,
        Math.max(0, ship.commandedSpeedKnots),
      );
    } else {
      const catchup = THREE.MathUtils.clamp(errorDistance / STRAGGLING_DISTANCE, 0, 1);
      ship.commandedSpeedKnots = Math.min(
        ship.definition.platform.maxSpeedKnots,
        force.formationState.speedKnots + catchup * 8,
      );
      const desiredHeading = errorDistance > ON_STATION_DISTANCE
        ? Math.atan2(-offset.z, offset.x)
        : force.formationState.heading;
      const maximumTurn = THREE.MathUtils.degToRad(ship.definition.platform.turnRateDeg) * dt;
      ship.heading += THREE.MathUtils.clamp(
        normalizeAngle(desiredHeading - ship.heading), -maximumTurn, maximumTurn,
      );
    }

    if (externallyIntegratedShipIds?.has(ship.id)) {
      force.formationState.stations.set(shipId, {
        desiredPosition: desired.toArray(), errorDistance,
        status: errorDistance <= ON_STATION_DISTANCE ? "on-station" : "maneuvering",
      });
      continue;
    }

    const speedDelta = ship.commandedSpeedKnots - ship.speedKnots;
    const speedRate = speedDelta >= 0
      ? ship.definition.platform.accelerationKnotsPerSecond
      : ship.definition.platform.decelerationKnotsPerSecond;
    ship.speedKnots += THREE.MathUtils.clamp(speedDelta, -speedRate * dt, speedRate * dt);
    ship.velocity.set(Math.cos(ship.heading), 0, -Math.sin(ship.heading))
      .multiplyScalar(ship.speedKnots * KNOTS_TO_WORLD_UNITS_PER_SECOND);
    ship.position.addScaledVector(ship.velocity, dt);
    ship.model.rotation.y = ship.heading;

    force.formationState.stations.set(shipId, {
      desiredPosition: desired.toArray(),
      errorDistance,
      status: errorDistance <= ON_STATION_DISTANCE
        ? "on-station"
        : errorDistance >= STRAGGLING_DISTANCE ? "straggling" : "maneuvering",
    });
  }
}
