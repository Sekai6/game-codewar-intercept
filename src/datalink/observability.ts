import type * as THREE from "three";
import type { Link11Diagnostics, Link16Diagnostics, TacticalNetworkActivity, TacticalNetworkKind } from "./types.js";

export interface TacticalNetworkNodeView {
  id: string;
  network: TacticalNetworkKind;
  position: THREE.Vector3;
  terminalHealth: number;
  transmitEnabled: boolean;
  receiveEnabled: boolean;
  role: "ncs" | "participant";
}

export interface TacticalNetworkTrackView {
  id: string;
  network: TacticalNetworkKind;
  position: THREE.Vector3;
  uncertainty: number;
  quality: number;
  age: number;
  classification: "unknown" | "aircraft" | "ship";
  senderId?: string;
}

export interface TacticalNetworkObservation {
  era: string;
  enabled: boolean;
  nodes: readonly TacticalNetworkNodeView[];
  tracks: readonly TacticalNetworkTrackView[];
  activities: readonly TacticalNetworkActivity[];
  link11: Readonly<Link11Diagnostics>;
  link16: Readonly<Link16Diagnostics>;
}
