import * as THREE from "three";
import type { CompiledScenario, CompiledScenarioRoute } from "./compiler.js";
import type { ScenarioForceDefinition } from "./types.js";

/** Runtime-only navigation and entity lookup state for one compiled scenario. */
export class ScenarioSession {
  private readonly routeCursors = new Map<string, number>();

  constructor(readonly scenario: CompiledScenario) {}
  reset() { this.routeCursors.clear(); }

  force(entityId: string): ScenarioForceDefinition | undefined {
    return this.scenario.document.forces.find((force) => force.id === entityId);
  }

  surfacePlatform(entityId?: string) {
    return entityId
      ? this.scenario.surfacePlatformSpawns.find((spawn) => spawn.id === entityId)
      : this.scenario.surfacePlatformSpawns[0];
  }

  routeFor(entityId: string): CompiledScenarioRoute | undefined {
    return this.scenario.initialStates.get(entityId)?.route;
  }

  waypointFor(entityId: string, position: THREE.Vector3, arrivalRadius: number): CompiledScenarioRoute["points"][number] | undefined {
    const route = this.routeFor(entityId);
    if (!route?.points.length) return undefined;
    let cursor = Math.min(this.routeCursors.get(entityId) ?? 0, route.points.length - 1);
    let waypoint = route.points[cursor];
    if (position.distanceTo(waypoint.position) <= arrivalRadius) {
      if (cursor < route.points.length - 1) cursor++;
      else if (route.loop) cursor = 0;
      this.routeCursors.set(entityId, cursor);
      waypoint = route.points[cursor];
    }
    return waypoint;
  }
}
