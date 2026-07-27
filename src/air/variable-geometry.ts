import * as THREE from "three";

export type WingSweepRange = readonly [minimum: number, maximum: number];

function finiteSweepRange(value: unknown): WingSweepRange | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const minimum = Number(value[0]);
  const maximum = Number(value[1]);
  return Number.isFinite(minimum) && Number.isFinite(maximum) &&
    minimum >= 0 && maximum >= minimum
    ? [minimum, maximum]
    : null;
}

/**
 * Resolve the aerodynamic sweep contract authored by the aircraft model.
 * Radians are preferred so the visual runtime never needs type-specific
 * degree constants; the degree fields remain a compatibility fallback.
 */
export function declaredWingSweepRange(
  model: THREE.Object3D,
): WingSweepRange | null {
  const radians = finiteSweepRange(model.userData.wingSweepRangeRad);
  if (radians) return radians;

  const minimumDeg = Number(model.userData.wingSweepMinDeg);
  const maximumDeg = Number(model.userData.wingSweepMaxDeg);
  return Number.isFinite(minimumDeg) && Number.isFinite(maximumDeg) &&
    minimumDeg >= 0 && maximumDeg >= minimumDeg
    ? [
        THREE.MathUtils.degToRad(minimumDeg),
        THREE.MathUtils.degToRad(maximumDeg),
      ]
    : null;
}

function wingSweepSign(wing: THREE.Object3D, index: number) {
  const declared = Number(wing.userData.wingSweepSign);
  if (declared === -1 || declared === 1) return declared;

  // Preserve compatibility with existing authored rigs without trusting
  // array insertion order when the side is encoded in the object name.
  const name = wing.name.toLowerCase();
  if (name.includes("starboard")) return -1;
  if (name.includes("port")) return 1;
  return index % 2 ? 1 : -1;
}

/**
 * Apply an aircraft-declared variable-wing sweep. Returns the unsigned sweep
 * angle, or null when the model has no complete variable-geometry contract.
 */
export function applyDeclaredWingSweep(
  model: THREE.Object3D,
  normalizedCommand: number,
) {
  const wings = model.userData.variableWings as THREE.Object3D[] | undefined;
  const range = declaredWingSweepRange(model);
  if (!wings?.length || !range) return null;

  const sweep = THREE.MathUtils.lerp(
    range[0],
    range[1],
    THREE.MathUtils.clamp(normalizedCommand, 0, 1),
  );
  wings.forEach((wing, index) => {
    wing.rotation.y = wingSweepSign(wing, index) * sweep;
  });
  return sweep;
}
