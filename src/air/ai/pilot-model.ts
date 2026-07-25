export interface PilotModel {
  reactionSeconds: number;
  perceptionRefreshSeconds: number;
  trackMemorySeconds: number;
  controlPrecision: number;
  riskTolerance: number;
  gTolerance: number;
  stressResistance: number;
  workloadCapacity: number;
}

export type PilotSkill = "rookie" | "regular" | "veteran" | "ace";

export interface PilotState {
  stress: number;
  fatigue: number;
  taskSaturation: number;
  gToleranceAvailable: number;
  threatReactionRemaining: number;
  previousThreatCount: number;
  effectiveReactionSeconds: number;
  effectiveControlPrecision: number;
  effectivePerceptionRefreshSeconds: number;
  effectiveTrackMemorySeconds: number;
  updates: number;
}

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));

export const STANDARD_ADVANCED_PILOT: PilotModel = {
  reactionSeconds: 0.65,
  perceptionRefreshSeconds: 0.25,
  trackMemorySeconds: 18,
  controlPrecision: 0.88,
  riskTolerance: 0.55,
  gTolerance: 7.2,
  stressResistance: 0.68,
  workloadCapacity: 5,
};

export const PILOT_MODELS: Readonly<Record<PilotSkill, PilotModel>> = {
  rookie: {
    reactionSeconds: 1.15,
    perceptionRefreshSeconds: 0.38,
    trackMemorySeconds: 12,
    controlPrecision: 0.72,
    riskTolerance: 0.35,
    gTolerance: 5.5,
    stressResistance: 0.38,
    workloadCapacity: 3.2,
  },
  regular: STANDARD_ADVANCED_PILOT,
  veteran: {
    reactionSeconds: 0.48,
    perceptionRefreshSeconds: 0.2,
    trackMemorySeconds: 22,
    controlPrecision: 0.93,
    riskTolerance: 0.62,
    gTolerance: 7.8,
    stressResistance: 0.8,
    workloadCapacity: 6.2,
  },
  ace: {
    reactionSeconds: 0.34,
    perceptionRefreshSeconds: 0.16,
    trackMemorySeconds: 26,
    controlPrecision: 0.96,
    riskTolerance: 0.7,
    gTolerance: 8.4,
    stressResistance: 0.9,
    workloadCapacity: 7.4,
  },
};

export const pilotModelForSkill = (skill: PilotSkill) => PILOT_MODELS[skill];

export const initialPilotState = (model = STANDARD_ADVANCED_PILOT): PilotState => ({
  stress: 0.08,
  fatigue: 0,
  taskSaturation: 0,
  gToleranceAvailable: model.gTolerance,
  threatReactionRemaining: 0,
  previousThreatCount: 0,
  effectiveReactionSeconds: model.reactionSeconds,
  effectiveControlPrecision: model.controlPrecision,
  effectivePerceptionRefreshSeconds: model.perceptionRefreshSeconds,
  effectiveTrackMemorySeconds: model.trackMemorySeconds,
  updates: 0,
});

export function stepPilotState(input: {
  state: PilotState;
  model?: PilotModel;
  dt: number;
  loadFactor: number;
  contactCount: number;
  threatCount: number;
  supportingWeapon: boolean;
  damaged: boolean;
}) {
  const model = input.model ?? STANDARD_ADVANCED_PILOT;
  const workload = input.contactCount * 0.55 + input.threatCount * 1.6 +
    (input.supportingWeapon ? 0.8 : 0) + (input.damaged ? 1.1 : 0);
  const taskSaturation = clamp(workload / Math.max(1, model.workloadCapacity));
  const stressDemand = clamp(taskSaturation * 0.72 +
    Math.max(0, input.loadFactor - 3) * 0.055 + (input.damaged ? 0.16 : 0));
  const stressRate = stressDemand > input.state.stress
    ? 0.48 * (1.15 - model.stressResistance * 0.45)
    : 0.11 * model.stressResistance;
  const stress = clamp(input.state.stress + clamp(
    stressDemand - input.state.stress,
    -stressRate * input.dt,
    stressRate * input.dt,
  ));
  const highG = Math.max(0, input.loadFactor - 4.5);
  const fatigue = clamp(input.state.fatigue +
    (highG * 0.012 + stress * 0.0025 - (highG <= 0 ? 0.004 : 0)) * input.dt);
  const gToleranceAvailable = clamp(
    model.gTolerance * (1 - fatigue * 0.38 - stress * 0.08),
    3.2,
    model.gTolerance,
  );
  let threatReactionRemaining = input.state.threatReactionRemaining;
  const effectiveReactionSeconds = model.reactionSeconds *
    (1 + stress * 0.85 + taskSaturation * 0.65);
  if (input.threatCount > input.state.previousThreatCount)
    threatReactionRemaining = effectiveReactionSeconds;
  else
    threatReactionRemaining = Math.max(0, threatReactionRemaining - input.dt);
  const effectiveControlPrecision = clamp(
    model.controlPrecision * (1 - stress * 0.22 - fatigue * 0.28),
    0.45,
    0.99,
  );
  return {
    stress,
    fatigue,
    taskSaturation,
    gToleranceAvailable,
    threatReactionRemaining,
    previousThreatCount: input.threatCount,
    effectiveReactionSeconds,
    effectiveControlPrecision,
    effectivePerceptionRefreshSeconds: model.perceptionRefreshSeconds *
      (1 + taskSaturation * 0.8 + stress * 0.35),
    effectiveTrackMemorySeconds: model.trackMemorySeconds *
      (1 - taskSaturation * 0.35 - stress * 0.18),
    updates: input.state.updates + 1,
  } satisfies PilotState;
}

export function pilotControlError(input: {
  pilotId: string;
  time: number;
  state: PilotState;
}) {
  let hash = 2166136261;
  for (const character of input.pilotId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const amplitudeDeg = (1 - input.state.effectiveControlPrecision) *
    (2.2 + input.state.stress * 3.8);
  const phase = (hash >>> 0) * 0.000001 + input.time * 0.73;
  return {
    headingDeg: Math.sin(phase) * amplitudeDeg,
    pitchDeg: Math.cos(phase * 0.71) * amplitudeDeg * 0.45,
  };
}
