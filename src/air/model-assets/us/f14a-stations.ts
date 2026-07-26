export type F14AStationPosition = readonly [number, number, number];

export interface F14AWeaponStation {
  id: string;
  position: F14AStationPosition;
  family: "glove" | "tunnel";
}

// F-14 weapons remain on the fixed shoulder glove and fuselage pallets. They
// must never become children of the variable wing pivots. The previous outer
// x=2.7 positions sat beyond the fixed glove outline and looked detached when
// the wings swept aft; these positions stay within the fixed lifting body.
export const F14A_GLOVE_STATIONS: readonly F14AWeaponStation[] = [
  { id: "wing-port-outer", position: [-2.08, -0.31, -0.08], family: "glove" },
  { id: "wing-port-inner", position: [-1.7, -0.38, 0.28], family: "glove" },
  { id: "wing-starboard-outer", position: [2.08, -0.31, -0.08], family: "glove" },
  { id: "wing-starboard-inner", position: [1.7, -0.38, 0.28], family: "glove" },
];

export const F14A_TUNNEL_STATIONS: readonly F14AWeaponStation[] = [
  { id: "tunnel-port-1", position: [-0.62, -0.75, -0.5], family: "tunnel" },
  { id: "tunnel-port-2", position: [-0.62, -0.75, 0.85], family: "tunnel" },
  { id: "tunnel-starboard-1", position: [0.62, -0.75, -0.5], family: "tunnel" },
  { id: "tunnel-starboard-2", position: [0.62, -0.75, 0.85], family: "tunnel" },
];

export const F14A_WEAPON_STATIONS = [
  ...F14A_GLOVE_STATIONS,
  ...F14A_TUNNEL_STATIONS,
] as const;
