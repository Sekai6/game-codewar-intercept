import type { AirPlatformInstance, AirTrack } from "../air/types.js";
import type { ArmEmitterRuntime } from "../arm/emitter-runtime.js";
import type { SovietCommandEra } from "./era.js";
import { sovietSeadCapability } from "./era.js";

export interface SovietSeadAssignment { shooterId: string; role: "primary" | "backup"; emitterId: string; cueQuality: number; createdAt: number; expiresAt: number; }

export class SovietSeadRuntime {
  private assignments = new Map<string, SovietSeadAssignment>();
  reset() { this.assignments.clear(); }
  update(era: SovietCommandEra, time: number, aircraft: readonly AirPlatformInstance[], emitters: ArmEmitterRuntime) {
    const capability = sovietSeadCapability(era);
    if (!capability.available) { this.assignments.clear(); return; }
    const group = aircraft.filter(a => a.alive && a.definition.id === "MIG-29A-SEAD" && a.mission === "sead");
    const cues = group.flatMap(a => [...a.passiveTracks.values()].filter(t => t.passive?.emitterId && time - t.lastUpdate <= 12 && t.quality >= .28).map(t => ({ a, t: t as AirTrack, emitterId: t.passive!.emitterId! })));
    const byEmitter = new Map<string, typeof cues[number]>();
    for (const cue of cues) if (!byEmitter.has(cue.emitterId) || cue.t.quality > byEmitter.get(cue.emitterId)!.t.quality) byEmitter.set(cue.emitterId, cue);
    for (const [emitterId, cue] of byEmitter) {
      if (!emitters.emitters.has(emitterId)) continue;
      const shooters = group.slice().sort((l, r) => l.id.localeCompare(r.id));
      const primary = shooters.find(a => a.id === cue.a.id) ?? shooters[0];
      if (!primary) continue;
      this.assignments.set(primary.id, { shooterId: primary.id, role: "primary", emitterId, cueQuality: cue.t.quality, createdAt: time, expiresAt: time + 12 });
      const backup = shooters.find(a => a.id !== primary.id);
      if (backup && capability.coordinatedPairAttack) this.assignments.set(backup.id, { shooterId: backup.id, role: "backup", emitterId, cueQuality: cue.t.quality * .9, createdAt: time, expiresAt: time + 12 });
    }
    for (const [id, assignment] of this.assignments) if (assignment.expiresAt < time || !group.some(a => a.id === id)) this.assignments.delete(id);
  }
  assignmentFor(id: string, time: number) { const a = this.assignments.get(id); return a && a.expiresAt >= time ? a : undefined; }
  snapshot(time: number) { return [...this.assignments.values()].filter(a => a.expiresAt >= time); }
}
