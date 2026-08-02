import type {
  ScenarioGuidanceCue,
  ScenarioGuidanceDefinition,
  ScenarioSide,
} from "./types";

export type ScenarioGuidanceMode = "full" | "critical" | "off";

/** Emitted only after a weapon physically leaves an entity-owned launcher/hardpoint. */
export interface ObservedPhysicalWeaponLaunch {
  type: "weapon-launch";
  side: ScenarioSide;
  platformId: string;
  launchId: string;
  weaponId: string;
  launcherId: string;
  targetTrackId: string;
  releaseSource: "ship-launcher" | "air-hardpoint";
  physicalRelease: true;
}

export type ScenarioGuidanceObservation =
  | { type: "space-weather-phase"; phase: string }
  | { type: "network-state"; side: ScenarioSide; state: "degraded" | "disconnected" | "recovering" }
  | { type: "platform-lost-comms"; platformId: string }
  | { type: "confirmed-track"; side: ScenarioSide; classification: "aircraft" | "ship" | "missile" }
  | ObservedPhysicalWeaponLaunch
  | { type: "objective-state"; objectiveId: string; state: "active" | "complete" | "failed" };

export interface ActiveGuidanceCue {
  cue: ScenarioGuidanceCue;
  activatedAt: number;
  expiresAt?: number;
}

export interface ScenarioGuidanceSnapshot {
  mode: ScenarioGuidanceMode;
  scenarioTime: number;
  paused: boolean;
  activeCue?: ActiveGuidanceCue;
  pending: readonly ActiveGuidanceCue[];
  firedCueIds: readonly string[];
}

/** Sanitized event stream intended for AAR/telemetry; it contains no target truth. */
export interface ScenarioGuidanceAuditEvent {
  time: number;
  action: "cue-activated" | "cue-dismissed" | "cue-expired" | "mode-changed";
  cueId?: string;
  category?: ScenarioGuidanceCue["category"];
  triggerType?: ScenarioGuidanceCue["trigger"]["type"];
  mode?: ScenarioGuidanceMode;
}

const observationMatches = (cue: ScenarioGuidanceCue, event: ScenarioGuidanceObservation) => {
  const trigger = cue.trigger;
  if (trigger.type !== event.type) return false;
  switch (trigger.type) {
    case "space-weather-phase": return trigger.phase === (event as Extract<ScenarioGuidanceObservation, { type: "space-weather-phase" }>).phase;
    case "network-state": {
      const observed = event as Extract<ScenarioGuidanceObservation, { type: "network-state" }>;
      return trigger.side === observed.side && trigger.state === observed.state;
    }
    case "platform-lost-comms": return trigger.platformId === (event as Extract<ScenarioGuidanceObservation, { type: "platform-lost-comms" }>).platformId;
    case "confirmed-track": {
      const observed = event as Extract<ScenarioGuidanceObservation, { type: "confirmed-track" }>;
      return trigger.side === observed.side && trigger.classification === observed.classification;
    }
    case "weapon-launch": {
      const observed = event as Extract<ScenarioGuidanceObservation, { type: "weapon-launch" }>;
      return observed.physicalRelease === true
        && observed.launchId.length > 0
        && observed.weaponId.length > 0
        && observed.launcherId.length > 0
        && observed.targetTrackId.length > 0
        && (!trigger.side || trigger.side === observed.side)
        && (!trigger.platformId || trigger.platformId === observed.platformId);
    }
    case "objective-state": {
      const observed = event as Extract<ScenarioGuidanceObservation, { type: "objective-state" }>;
      return trigger.objectiveId === observed.objectiveId && trigger.state === observed.state;
    }
    default: return false;
  }
};

export class ScenarioGuidanceRuntime {
  private mode: ScenarioGuidanceMode;
  private time = 0;
  private paused = false;
  private lastSignificantEventAt = 0;
  private inactivityArmedAt = new Map<string, number>();
  private fired = new Set<string>();
  private queue: ActiveGuidanceCue[] = [];
  private current?: ActiveGuidanceCue;
  private audit: ScenarioGuidanceAuditEvent[] = [];

  constructor(
    readonly definition: ScenarioGuidanceDefinition,
    mode: ScenarioGuidanceMode = "full",
  ) {
    this.mode = mode;
  }

  setMode(mode: ScenarioGuidanceMode) {
    this.mode = mode;
    this.audit.push({ time: this.time, action: "mode-changed", mode });
    if (mode === "off") {
      this.current = undefined;
      this.queue = [];
    } else {
      if (this.current && !this.visible(this.current.cue)) this.current = undefined;
      this.queue = this.queue.filter((entry) => this.visible(entry.cue));
      if (!this.current) this.current = this.queue.shift();
    }
  }

  setPaused(paused: boolean) { this.paused = paused; }

  update(scenarioTime: number) {
    if (this.paused) return this.snapshot();
    const previous = this.time;
    this.time = Math.max(this.time, scenarioTime);
    for (const cue of this.definition.cues) {
      if (cue.trigger.type === "time" && cue.trigger.at > previous && cue.trigger.at <= this.time) this.activate(cue);
      if (cue.trigger.type === "time" && previous === 0 && cue.trigger.at === 0) this.activate(cue);
      if (cue.trigger.type === "inactivity") {
        const eligibleAt = this.lastSignificantEventAt + cue.trigger.seconds;
        const armedAt = this.inactivityArmedAt.get(cue.id) ?? eligibleAt;
        this.inactivityArmedAt.set(cue.id, armedAt);
        if (armedAt > previous && armedAt <= this.time) this.activate(cue);
      }
    }
    this.expireAndAdvance();
    return this.snapshot();
  }

  observe(event: ScenarioGuidanceObservation, scenarioTime = this.time) {
    if (!this.paused) this.time = Math.max(this.time, scenarioTime);
    this.lastSignificantEventAt = this.time;
    this.inactivityArmedAt.clear();
    for (const cue of this.definition.cues) if (observationMatches(cue, event)) this.activate(cue);
    this.expireAndAdvance();
    return this.snapshot();
  }

  dismissCurrent() {
    if (this.current) this.audit.push({ time: this.time, action: "cue-dismissed", cueId: this.current.cue.id, category: this.current.cue.category, triggerType: this.current.cue.trigger.type });
    this.current = this.queue.shift();
    return this.snapshot();
  }

  /** Destructive read keeps long scenarios from accumulating an unbounded UI/AAR buffer. */
  drainAuditEvents() {
    const events = this.audit;
    this.audit = [];
    return events as readonly ScenarioGuidanceAuditEvent[];
  }

  reset(scenarioTime = 0) {
    this.time = scenarioTime;
    this.lastSignificantEventAt = scenarioTime;
    this.inactivityArmedAt.clear();
    this.fired.clear();
    this.queue = [];
    this.current = undefined;
    this.audit = [];
  }

  snapshot(): ScenarioGuidanceSnapshot {
    return {
      mode: this.mode,
      scenarioTime: this.time,
      paused: this.paused,
      activeCue: this.current,
      pending: [...this.queue],
      firedCueIds: [...this.fired],
    };
  }

  private visible(cue: ScenarioGuidanceCue) {
    return this.mode === "full" || (this.mode === "critical" && cue.level === "critical");
  }

  private activate(cue: ScenarioGuidanceCue) {
    if (!this.visible(cue) || (cue.once && this.fired.has(cue.id))) return;
    if (this.current?.cue.id === cue.id || this.queue.some((entry) => entry.cue.id === cue.id)) return;
    if (cue.once) this.fired.add(cue.id);
    const active: ActiveGuidanceCue = {
      cue,
      activatedAt: this.time,
      expiresAt: cue.expiresAfter == null ? undefined : this.time + cue.expiresAfter,
    };
    this.audit.push({ time: this.time, action: "cue-activated", cueId: cue.id, category: cue.category, triggerType: cue.trigger.type });
    if (!this.current) this.current = active;
    else this.queue.push(active);
    if (cue.trigger.type === "inactivity" && !cue.once) this.inactivityArmedAt.set(cue.id, this.time + cue.trigger.seconds);
  }

  private expireAndAdvance() {
    while (this.current?.expiresAt != null && this.time >= this.current.expiresAt) {
      this.audit.push({ time: this.time, action: "cue-expired", cueId: this.current.cue.id, category: this.current.cue.category, triggerType: this.current.cue.trigger.type });
      this.current = this.queue.shift();
    }
  }
}
