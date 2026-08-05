export type FormationStatus = "joined" | "separated" | "rejoining";

export interface FormationSlotOffset {
  lateral: number;
  vertical: number;
  trail: number;
}

/**
 * Canonical formation geometry shared by scenario compilation and runtime
 * station keeping. Slot zero is the leader; followers alternate right/left
 * and move progressively aft so larger formations remain deterministic.
 */
export function formationSlotOffset(formationIndex: number): FormationSlotOffset {
  if (formationIndex <= 0) return { lateral: 0, vertical: 0, trail: 0 };
  const followerIndex = formationIndex - 1;
  const row = Math.floor(followerIndex / 2);
  const side = followerIndex % 2 === 0 ? 1 : -1;
  return {
    lateral: side * (12 + row * 5),
    vertical: 2,
    trail: 10 + row * 10,
  };
}

export function updateFormationStatus(input: {
  current: FormationStatus;
  error: number;
  joinDistance: number;
  breakDistance: number;
}) {
  if (input.current === "joined")
    return input.error > input.breakDistance ? "separated" : "joined";
  if (input.error <= input.joinDistance) return "joined";
  return "rejoining";
}

export function formationSlot(input: {
  leader: { x: number; y: number; z: number };
  leaderHeading: { x: number; y: number; z: number };
  lateral: number;
  vertical: number;
  trail: number;
}) {
  const horizontalLength = Math.hypot(
    input.leaderHeading.x,
    input.leaderHeading.z,
  ) || 1;
  const forwardX = input.leaderHeading.x / horizontalLength;
  const forwardZ = input.leaderHeading.z / horizontalLength;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  return {
    x: input.leader.x + rightX * input.lateral - forwardX * input.trail,
    y: input.leader.y + input.vertical,
    z: input.leader.z + rightZ * input.lateral - forwardZ * input.trail,
  };
}

export function formationSlotForIndex(input: {
  leader: { x: number; y: number; z: number };
  leaderHeading: { x: number; y: number; z: number };
  formationIndex: number;
}) {
  return formationSlot({
    leader: input.leader,
    leaderHeading: input.leaderHeading,
    ...formationSlotOffset(input.formationIndex),
  });
}
