export const WORLD_SPEED_TO_METERS_PER_SECOND = 100 / 3.6;
export const WORLD_ALTITUDE_TO_METERS = 100;

export function coordinatedTurnRateDegPerSecond(input: {
  speedWorld: number;
  bankDeg: number;
  gravity?: number;
}) {
  const speedMetersPerSecond = Math.max(
    1,
    input.speedWorld * WORLD_SPEED_TO_METERS_PER_SECOND,
  );
  const bankRadians = input.bankDeg * Math.PI / 180;
  return (input.gravity ?? 9.81) * Math.tan(bankRadians) /
    speedMetersPerSecond * 180 / Math.PI;
}
