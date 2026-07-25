import * as THREE from "three";
import type { AirMissionOrder, AirTrack } from "../types";

export type PilotObservationSource =
  | "organic-radar"
  | "tactical-network"
  | "missile-warning"
  | "memory";

export interface PilotContact {
  trackNumber: string;
  estimatedPosition: THREE.Vector3;
  estimatedVelocity: THREE.Vector3;
  classification: AirTrack["classification"];
  identityConfidence: number;
  quality: number;
  uncertainty: number;
  observedAt: number;
  estimatedAt: number;
  source: PilotObservationSource;
  weaponAuthorization: boolean;
}

export interface PilotObservation {
  trackNumber: string;
  estimatedPosition: THREE.Vector3;
  estimatedVelocity: THREE.Vector3;
  classification: AirTrack["classification"];
  quality: number;
  uncertainty: number;
  observedAt: number;
  source: Exclude<PilotObservationSource, "memory">;
  weaponAuthorization: boolean;
}

export interface PilotPerceptionState {
  contacts: Map<string, PilotContact>;
  nextTrackSerial: number;
  updateCount: number;
}

export const initialPilotPerception = (): PilotPerceptionState => ({
  contacts: new Map(),
  nextTrackSerial: 1,
  updateCount: 0,
});

export function updatePilotPerception(input: {
  state: PilotPerceptionState;
  observations: readonly PilotObservation[];
  time: number;
  memorySeconds: number;
}) {
  const contacts = new Map<string, PilotContact>();
  for (const [trackNumber, previous] of input.state.contacts) {
    const age = input.time - previous.observedAt;
    if (age > input.memorySeconds) continue;
    const projectionStep = Math.max(0, input.time - previous.estimatedAt);
    contacts.set(trackNumber, {
      ...previous,
      estimatedPosition: previous.estimatedPosition.clone()
        .addScaledVector(previous.estimatedVelocity, projectionStep),
      quality: Math.max(0.01, previous.quality * Math.exp(-age * 0.14)),
      uncertainty: previous.uncertainty + projectionStep * 1.8,
      estimatedAt: input.time,
      source: "memory",
      weaponAuthorization: false,
    });
  }
  let nextTrackSerial = input.state.nextTrackSerial;
  for (const observation of input.observations) {
    contacts.set(observation.trackNumber, {
      trackNumber: observation.trackNumber,
      estimatedPosition: observation.estimatedPosition.clone(),
      estimatedVelocity: observation.estimatedVelocity.clone(),
      classification: observation.classification,
      identityConfidence: observation.classification === "unknown"
        ? observation.quality * 0.35
        : observation.quality,
      quality: observation.quality,
      uncertainty: observation.uncertainty,
      observedAt: observation.observedAt,
      estimatedAt: input.time,
      source: observation.source,
      weaponAuthorization: observation.source === "organic-radar" &&
        observation.weaponAuthorization,
    });
    const serial = Number(observation.trackNumber.slice(2));
    if (Number.isFinite(serial)) nextTrackSerial = Math.max(nextTrackSerial, serial + 1);
  }
  return {
    state: {
      contacts,
      nextTrackSerial,
      updateCount: input.state.updateCount + 1,
    },
  };
}

export function selectPilotContact(input: {
  mission: AirMissionOrder;
  contacts: readonly PilotContact[];
  origin: THREE.Vector3;
}) {
  const classification = input.mission === "anti-ship" ? "ship" : "aircraft";
  return input.contacts
    .filter((contact) => contact.classification === classification)
    .sort((left, right) => {
      const leftScore = left.estimatedPosition.distanceTo(input.origin) /
          Math.max(0.05, left.quality) + left.uncertainty * 0.7;
      const rightScore = right.estimatedPosition.distanceTo(input.origin) /
          Math.max(0.05, right.quality) + right.uncertainty * 0.7;
      return leftScore - rightScore;
    })[0];
}
