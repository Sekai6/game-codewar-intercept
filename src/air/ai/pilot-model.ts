export interface PilotModel {
  reactionSeconds: number;
  perceptionRefreshSeconds: number;
  trackMemorySeconds: number;
  controlPrecision: number;
  riskTolerance: number;
}

export const STANDARD_ADVANCED_PILOT: PilotModel = {
  reactionSeconds: 0.65,
  perceptionRefreshSeconds: 0.25,
  trackMemorySeconds: 18,
  controlPrecision: 0.88,
  riskTolerance: 0.55,
};
