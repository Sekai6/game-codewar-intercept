export type LostCommsDoctrineId =
  | "us-ntu-command"
  | "us-ntu-picket"
  | "us-aew-orbit"
  | "us-cap-last-vector"
  | "us-strike-autonomous"
  | "soviet-aew-hold"
  | "soviet-raid-preplanned"
  | "soviet-escort-axis"
  | "soviet-surface-autonomous";

export interface LostCommsState {
  platformId: string;
  doctrineId: LostCommsDoctrineId;
  enteredAt: number | null;
  lastCommandAt: number;
  lastNetworkTrackAt: number;
  autonomyLevel: number;
  rendezvousAt?: number;
  commandAssumed: boolean;
  connected: boolean;
  recoveryStartedAt: number | null;
}

export interface LostCommsUpdate {
  time: number;
  linkQuality: number;
  commandReceived?: boolean;
  networkTrackReceived?: boolean;
}

export interface LostCommsTransition {
  platformId: string;
  kind: "entered" | "recovering" | "restored";
  time: number;
  doctrineId: LostCommsDoctrineId;
}
