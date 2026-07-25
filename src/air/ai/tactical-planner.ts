import * as THREE from "three";
import type { AirTrack } from "../types";
import type { AirTacticalMode } from "./tactical-state.js";
import {
  crankManeuver,
  dragManeuver,
  notchManeuver,
  pumpManeuver,
} from "./maneuver-library.js";

export interface BvrPlan {
  mode: AirTacticalMode;
  desiredDirection: THREE.Vector3;
  energyPriority: "preserve" | "neutral" | "spend";
}

export function planBvrManeuver(input: {
  ownPosition: THREE.Vector3;
  currentHeading: THREE.Vector3;
  formationSide: -1 | 1;
  targetTrack?: AirTrack;
  warningTrack?: AirTrack;
  warningTti?: number;
  supportingWeapon?: { seekerAcquired: boolean; guidance: string };
  timeSinceLaunch?: number;
}): BvrPlan {
  if (input.warningTrack && input.warningTti !== undefined) {
    if (input.warningTti < 9)
      return {
        mode: "drag",
        desiredDirection: dragManeuver({
          threatPosition: input.warningTrack.position,
          ownPosition: input.ownPosition,
          descentBias: 0.07,
        }),
        energyPriority: "spend",
      };
    return {
      mode: "notch",
      desiredDirection: notchManeuver({
        threatVelocity: input.warningTrack.velocity,
        side: input.formationSide,
      }),
      energyPriority: "preserve",
    };
  }
  if (input.targetTrack && input.supportingWeapon) {
    if (!input.supportingWeapon.seekerAcquired ||
        input.supportingWeapon.guidance === "semi-active-radar")
      return {
        mode: "crank",
        desiredDirection: crankManeuver({
          lineOfSight: input.targetTrack.position.clone().sub(input.ownPosition),
          side: input.formationSide,
          climbBias: 0.015,
        }),
        energyPriority: "preserve",
      };
    return {
      mode: "pump",
      desiredDirection: pumpManeuver({
        targetPosition: input.targetTrack.position,
        ownPosition: input.ownPosition,
        side: input.formationSide,
      }),
      energyPriority: "preserve",
    };
  }
  if (input.targetTrack)
    return {
      mode: "commit",
      desiredDirection: input.targetTrack.position.clone()
        .sub(input.ownPosition).normalize(),
      energyPriority: "preserve",
    };
  return {
    mode: "mission",
    desiredDirection: input.currentHeading.clone(),
    energyPriority: "neutral",
  };
}
