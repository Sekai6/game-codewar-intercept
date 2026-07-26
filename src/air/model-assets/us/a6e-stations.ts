export type A6EStationPosition = readonly [number, number, number];

export interface A6EPylonStation {
  id: string;
  position: A6EStationPosition;
  attachment: "wing" | "centerline";
  weaponStation: boolean;
  railContactOffsetY: number;
}

export const A6E_PYLON_STATIONS: readonly A6EPylonStation[] = [
  {
    id: "wing-port-inner-visual",
    position: [-1.16, -0.5, 0.14],
    attachment: "wing",
    weaponStation: false,
    railContactOffsetY: 0.125,
  },
  {
    id: "wing-starboard-inner-visual",
    position: [1.16, -0.5, 0.14],
    attachment: "wing",
    weaponStation: false,
    railContactOffsetY: 0.125,
  },
  {
    id: "wing-port-strike",
    position: [-2.15, -0.52, 0.25],
    attachment: "wing",
    weaponStation: true,
    railContactOffsetY: 0.125,
  },
  {
    id: "wing-starboard-strike",
    position: [2.15, -0.52, 0.25],
    attachment: "wing",
    weaponStation: true,
    railContactOffsetY: 0.125,
  },
  {
    id: "centerline-visual",
    position: [0, -0.58, 0.42],
    attachment: "centerline",
    weaponStation: false,
    railContactOffsetY: 0.0275,
  },
];

export const A6E_STRIKE_STATIONS = A6E_PYLON_STATIONS.filter(
  (station) => station.weaponStation,
);
