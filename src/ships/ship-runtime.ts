import * as THREE from "three";
import type { CombatSide } from "../combat-entity.js";
import type { ShipDefinition, ShipWeapon, SubsystemId } from "../ship-types.js";
import type { ShipCombatantInstance } from "./types.js";

const SUBSYSTEMS: readonly SubsystemId[] = [
  "primaryRadar", "secondaryRadar", "fireControl", "aftLauncher",
  "forwardLauncher", "ciws", "ecm", "srboc", "propulsion",
];

export interface CreateShipCombatantInput {
  id: string;
  forceId: string;
  side: CombatSide;
  definition: ShipDefinition;
  model?: THREE.Group;
  preserveModelTransform?: boolean;
  position: THREE.Vector3;
  heading: number;
  initialSpeedKnots?: number;
  loadout?: Partial<Record<ShipWeapon | "ciws" | "surfaceStrike", number>>;
}

export function createShipCombatant(input: CreateShipCombatantInput): ShipCombatantInstance {
  const model = input.model ?? input.definition.build();
  if (!input.preserveModelTransform) {
    model.position.copy(input.position);
    model.rotation.y = input.heading;
  }
  const speedKnots = input.initialSpeedKnots ?? input.definition.platform.patrolSpeedKnots;
  const velocity = new THREE.Vector3(Math.cos(input.heading), 0, -Math.sin(input.heading))
    .multiplyScalar(speedKnots * 0.005144);
  const rounds = new Map<ShipWeapon, number>([
    ["RIM-67", input.loadout?.["RIM-67"] ?? input.definition.ammo.rim67],
    ["SM-2MR", input.loadout?.["SM-2MR"] ?? input.definition.ammo.sm2mr],
    ["SM-2ER", input.loadout?.["SM-2ER"] ?? input.definition.ammo.sm2er],
  ]);
  const instance: ShipCombatantInstance = {
    id: input.id,
    forceId: input.forceId,
    side: input.side,
    kind: "ship",
    definition: input.definition,
    model,
    position: model.position,
    velocity,
    radarCrossSection: input.definition.platform.radarRcs,
    infraredSignature: 0.8,
    emissionState: {
      radarEmitting: true,
      communicationEmitting: true,
      jammerEmitting: Boolean(input.definition.electronicWarfare),
      emissionStrength: 0.75,
    },
    alive: true,
    heading: input.heading,
    speedKnots,
    commandedSpeedKnots: speedKnots,
    maneuverMode: "patrol",
    hullIntegrity: 100,
    subsystemHealth: new Map(SUBSYSTEMS.map((id) => [id, 100])),
    damageControl: {
      fireIntensity: 0,
      flooding: 0,
      damageControlCapacity: 100,
      lastImpactAt: Number.NEGATIVE_INFINITY,
      casualtyCount: 0,
    },
    magazines: {
      rounds,
      ciws: input.loadout?.ciws ?? input.definition.ammo.ciws,
      surfaceStrike: input.loadout?.surfaceStrike ?? input.definition.surfaceStrike?.magazine ?? 0,
    },
    electronicWarfare: {
      ecmEnabled: Boolean(input.definition.electronicWarfare),
      decoyEnabled: Boolean(input.definition.electronicWarfare),
      ecmStrength: input.definition.electronicWarfare?.ecmStrength ?? 0,
      burnThroughRange: input.definition.electronicWarfare?.burnThroughRange ?? 0,
      decoyRounds: input.definition.electronicWarfare?.decoyRounds ?? 0,
      decoyCooldownSeconds: input.definition.electronicWarfare?.decoyCooldownSeconds ?? 0,
      decoyDeployRange: input.definition.electronicWarfare?.decoyDeployRange ?? 0,
      decoyRcs: input.definition.electronicWarfare?.decoyRcs ?? 0,
      decoyLifeSeconds: input.definition.electronicWarfare?.decoyLifeSeconds ?? 0,
      nextDecoyAt: Number.NEGATIVE_INFINITY,
      decoys: [],
    },
    localTracks: new Map(),
    networkTracks: new Map(),
    engagements: new Map(),
    launcherChannels: input.definition.ammo.channels,
    illuminatorChannels: input.definition.ammo.illuminators,
    emconMode: input.definition.defaultEmconMode ?? "active",
    passiveTracks: new Map(),
    nextPassiveScan: 0,
    cecTracks: new Map(),
    applyDamage: (damage) => {
      instance.hullIntegrity = Math.max(0, instance.hullIntegrity - damage);
      if (instance.hullIntegrity <= 0) {
        instance.alive = false;
        instance.maneuverMode = "disabled";
        instance.commandedSpeedKnots = 0;
      }
    },
  };
  return instance;
}
