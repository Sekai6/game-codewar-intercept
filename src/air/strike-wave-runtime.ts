import type { CombatSide } from "../combat-entity.js";

export type StrikeWaveState = "assembling" | "approaching" | "holding" |
  "authorized" | "launching" | "egressing" | "aborted";

export interface StrikeWaveDefinition {
  id: string;
  side: CombatSide;
  shooterIds: readonly string[];
  targetCandidates: readonly string[];
  plannedLaunchWindow: readonly [number, number];
  desiredImpactTime?: number;
  minimumShooters: number;
  maximumShooters: number;
  maximumWeaponsPerTarget: number;
}

export interface StrikeWaveShooterStatus {
  id: string;
  alive: boolean;
  weaponReady: boolean;
  inLaunchZone: boolean;
  missionValid: boolean;
  estimatedTimeToImpact?: number;
}

export interface StrikeWaveSnapshot extends StrikeWaveDefinition {
  launchedShooters: readonly string[];
  state: StrikeWaveState;
  authorizedShooters: readonly string[];
}

export class StrikeWaveRuntime {
  private readonly waves = new Map<string, {
    definition: StrikeWaveDefinition;
    launched: Set<string>;
    state: StrikeWaveState;
    authorized: string[];
  }>();

  configure(definitions: readonly StrikeWaveDefinition[]) {
    this.waves.clear();
    for (const definition of definitions) this.waves.set(definition.id, {
      definition: { ...definition }, launched: new Set(), state: "assembling", authorized: [],
    });
  }

  update(id: string, time: number, shooters: readonly StrikeWaveShooterStatus[]) {
    const wave = this.waves.get(id);
    if (!wave || wave.state === "aborted" || wave.state === "egressing") return this.snapshot(id);
    const [start, end] = wave.definition.plannedLaunchWindow;
    const viable = shooters.filter((shooter) => shooter.alive && shooter.weaponReady && shooter.missionValid);
    const ready = viable.filter((shooter) =>
      shooter.inLaunchZone && !wave.launched.has(shooter.id) &&
      (wave.definition.desiredImpactTime === undefined ||
        shooter.estimatedTimeToImpact === undefined ||
        time + shooter.estimatedTimeToImpact <= wave.definition.desiredImpactTime));
    if (time > end && wave.launched.size === 0) {
      wave.state = "aborted";
      wave.authorized = [];
      return this.snapshot(id);
    }
    if (wave.launched.size >= wave.definition.maximumShooters ||
        (time > end && wave.launched.size > 0)) {
      wave.state = "egressing";
      wave.authorized = [];
      return this.snapshot(id);
    }
    if (time < start) {
      wave.state = ready.length >= wave.definition.minimumShooters ? "holding" :
        viable.length >= wave.definition.minimumShooters ? "approaching" : "assembling";
      wave.authorized = [];
      return this.snapshot(id);
    }
    if (ready.length >= wave.definition.minimumShooters || wave.launched.size > 0) {
      wave.authorized = ready.slice(0, wave.definition.maximumShooters - wave.launched.size).map((x) => x.id);
      wave.state = wave.launched.size ? "launching" : "authorized";
    } else {
      wave.state = "holding";
      wave.authorized = [];
    }
    return this.snapshot(id);
  }

  allows(id: string, shooterId: string) {
    return this.waves.get(id)?.authorized.includes(shooterId) ?? false;
  }

  recordLaunch(id: string, shooterId: string) {
    const wave = this.waves.get(id);
    if (!wave) return;
    wave.launched.add(shooterId);
    wave.authorized = wave.authorized.filter((candidate) => candidate !== shooterId);
    wave.state = wave.launched.size >= wave.definition.maximumShooters ? "egressing" : "launching";
  }

  snapshot(id: string): StrikeWaveSnapshot | undefined {
    const wave = this.waves.get(id);
    return wave ? { ...wave.definition, launchedShooters: [...wave.launched], state: wave.state,
      authorizedShooters: [...wave.authorized] } : undefined;
  }

  snapshots() { return [...this.waves.keys()].flatMap((id) => this.snapshot(id) ?? []); }
}
