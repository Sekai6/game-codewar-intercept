import * as THREE from "three";
import { AIR_PLATFORM_BY_ID } from "./catalog";
import type { AirMissionOrder, AirPlatformId, AirSpawn } from "./types";

function pair(input: {
  platformId: AirPlatformId;
  side: "blue" | "red";
  formationId: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  wingmanMission?: AirMissionOrder;
  protectedFormationId?: string;
}): AirSpawn[] {
  const definition = AIR_PLATFORM_BY_ID[input.platformId];
  return [0, 1].map((formationIndex) => ({
    definition,
    side: input.side,
    formationId: input.formationId,
    position: input.position.clone().add(
      new THREE.Vector3(
        (formationIndex ? 1 : -1) * 12,
        formationIndex * 2,
        formationIndex ? 9 : -4,
      ),
    ),
    heading: input.heading.clone(),
    formationIndex,
    mission: formationIndex === 1 ? input.wingmanMission : undefined,
    protectedFormationId:
      formationIndex === 1 ? input.protectedFormationId : undefined,
  }));
}

export type AirScenarioPresetId = "joint" | "intercept" | "strike" | "fighter" | "aew";

function single(input: {
  platformId:AirPlatformId; side:"blue"|"red"; formationId:string;
  position:THREE.Vector3; heading:THREE.Vector3;
}):AirSpawn[]{return [{definition:AIR_PLATFORM_BY_ID[input.platformId],side:input.side,formationId:input.formationId,position:input.position.clone(),heading:input.heading.clone(),formationIndex:0}];}

function jointAirScenarioSpawns(): AirSpawn[] {
  return [
    ...pair({
      platformId: "F-14A",
      side: "blue",
      formationId: "CAP-1",
      position: new THREE.Vector3(-170, 72, -500),
      heading: new THREE.Vector3(0.25, 0, -1),
      wingmanMission: "escort",
      protectedFormationId: "STRIKE-1",
    }),
    ...pair({
      platformId: "TU-16K",
      side: "red",
      formationId: "RAID-1",
      position: new THREE.Vector3(80, 92, -1050),
      heading: new THREE.Vector3(-0.15, -0.01, 1),
    }),
    ...pair({
      platformId: "A-6E",
      side: "blue",
      formationId: "STRIKE-1",
      position: new THREE.Vector3(-60, 18, -220),
      heading: new THREE.Vector3(0.15, 0, -1),
    }),
  ];
}

function interceptScenarioSpawns(): AirSpawn[] {
  return [
    ...pair({
      platformId: "F-14A",
      side: "blue",
      formationId: "INTERCEPT-1",
      position: new THREE.Vector3(-150, 70, -500),
      heading: new THREE.Vector3(0.2, 0, -1),
      wingmanMission: "intercept",
    }),
    ...pair({
      platformId: "TU-16K",
      side: "red",
      formationId: "RAID-1",
      position: new THREE.Vector3(70, 88, -1050),
      heading: new THREE.Vector3(-0.12, -0.01, 1),
    }),
  ];
}

function strikeScenarioSpawns(): AirSpawn[] {
  return pair({
    platformId: "A-6E",
    side: "blue",
    formationId: "STRIKE-1",
    position: new THREE.Vector3(-60, 18, -220),
    heading: new THREE.Vector3(0.15, 0, -1),
  });
}

function fighterScenarioSpawns(): AirSpawn[] {
  return [
    ...pair({
      platformId: "F-14A",
      side: "blue",
      formationId: "CAP-FIGHTER-1",
      position: new THREE.Vector3(-150, 72, -480),
      heading: new THREE.Vector3(0.15, 0, -1),
      wingmanMission: "intercept",
    }),
    ...pair({
      platformId: "MIG-29A",
      side: "red",
      formationId: "FULCRUM-1",
      position: new THREE.Vector3(65, 68, -1080),
      heading: new THREE.Vector3(-0.15, 0, 1),
      wingmanMission: "intercept",
    }),
  ];
}

function aewScenarioSpawns():AirSpawn[]{return [
  ...single({platformId:"E-2C",side:"blue",formationId:"AEW-BLUE-1",position:new THREE.Vector3(-260,92,-520),heading:new THREE.Vector3(.2,0,-1)}),
  ...pair({platformId:"F-14A",side:"blue",formationId:"AEW-CAP-1",position:new THREE.Vector3(-120,70,-610),heading:new THREE.Vector3(.1,0,-1),wingmanMission:"intercept"}),
  ...single({platformId:"TU-126",side:"red",formationId:"AEW-RED-1",position:new THREE.Vector3(270,98,-1120),heading:new THREE.Vector3(-.18,0,1)}),
  ...pair({platformId:"MIG-29A",side:"red",formationId:"AEW-INTERCEPT-1",position:new THREE.Vector3(80,68,-1030),heading:new THREE.Vector3(-.1,0,1),wingmanMission:"intercept"}),
];}

export const AIR_SCENARIO_PRESETS: Readonly<Record<AirScenarioPresetId, {
  label: string;
  description: string;
  createSpawns: () => AirSpawn[];
}>> = {
  joint: { label: "JOINT", description: "F-14A CAP + escort / Tu-16K raid / A-6E strike", createSpawns: jointAirScenarioSpawns },
  intercept: { label: "INTERCEPT", description: "F-14A intercept / Tu-16K raid", createSpawns: interceptScenarioSpawns },
  strike: { label: "STRIKE", description: "A-6E anti-ship strike", createSpawns: strikeScenarioSpawns },
  fighter: { label: "FIGHTER", description: "F-14A CAP / MiG-29A intercept", createSpawns: fighterScenarioSpawns },
  aew: { label:"AEW", description:"E-2C fleet AEW / Tu-126 GCI support / fighter screens", createSpawns:aewScenarioSpawns },
};

export function airScenarioSpawns(
  id: AirScenarioPresetId,
  shortValidation = false,
  sovietSalvoValidation = false,
  bfmValidation = false,
): AirSpawn[] {
  const spawns = AIR_SCENARIO_PRESETS[id].createSpawns();
  if (bfmValidation && id === "fighter") {
    for (const spawn of spawns) {
      const blue = spawn.side === "blue";
      spawn.position.set(
        (spawn.formationIndex ? 1 : -1) * 10 + (blue ? -12 : 12),
        40 + spawn.formationIndex * 2,
        blue ? -500 + spawn.formationIndex * 5 : -570 - spawn.formationIndex * 5,
      );
      spawn.heading.set(blue ? 0.04 : -0.04, 0, blue ? -1 : 1).normalize();
    }
    return spawns;
  }
  if (!shortValidation) return spawns;
  if (id === "fighter") {
    for (const spawn of spawns)
      if (spawn.definition.id === "MIG-29A") spawn.position.z += 350;
    return spawns;
  }
  if (id !== "joint" && id !== "intercept") return spawns;
  for (const spawn of spawns) {
    if (spawn.definition.id === "TU-16K") spawn.position.z += 800;
    if (spawn.definition.id === "F-14A") spawn.position.z += 280;
    if (sovietSalvoValidation && spawn.definition.id === "F-14A")
      spawn.position.z -= 600;
  }
  return spawns;
}
