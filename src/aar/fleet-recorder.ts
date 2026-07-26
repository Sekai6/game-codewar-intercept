import type { AarEvent, AarFleetSnapshot } from "../combat-types.js";
import type { FleetObservation } from "../fleet/observability.js";

export interface FleetAarSample {
  snapshot: AarFleetSnapshot;
  events: AarEvent[];
}

export class FleetAarRecorder {
  private seen = new Set<string>();
  private roleOwners = new Map<string, string>();
  private assignmentStates = new Map<string, string>();
  private engagementStates = new Map<string, string>();
  private stationStates = new Map<string, string>();
  private configuration = "";

  reset() {
    this.seen.clear();
    this.roleOwners.clear();
    this.assignmentStates.clear();
    this.engagementStates.clear();
    this.stationStates.clear();
    this.configuration = "";
  }

  sample(observation: FleetObservation, time: number): FleetAarSample {
    const events: AarEvent[] = [];
    const emit = (eventTime: number, category: AarEvent["category"], text: string) =>
      events.push({ time: eventTime, category, text });
    const configuration = `${observation.id}|${observation.formation}|${observation.datalinkEra}|${observation.link11Enabled}`;
    if (configuration !== this.configuration) {
      emit(time, "network", `NAVAL FORCE / ${observation.id} / ${observation.formation.toUpperCase()} / LINK 11 ${observation.link11Enabled ? "ENABLED" : "DISCONNECTED"}`);
      this.configuration = configuration;
    }
    for (const member of observation.members) {
      for (const role of member.commandRoles) {
        const previous = this.roleOwners.get(role);
        if (previous !== member.id) {
          emit(time, "system", `FLEET COMMAND ${role.toUpperCase()} / ${previous ?? "NONE"} -> ${member.id}`);
          this.roleOwners.set(role, member.id);
        }
      }
      const station = `${member.stationStatus}|${Math.round(member.stationError)}`;
      if (this.stationStates.get(member.id) !== station) {
        emit(time, "maneuver", `FLEET STATION / ${member.id} / ${member.stationStatus.toUpperCase()} / ERROR ${member.stationError.toFixed(1)}`);
        this.stationStates.set(member.id, station);
      }
    }
    for (const track of observation.tracks) {
      const key = `track:${track.id}:${track.contributors.slice().sort().join("+")}`;
      if (!this.seen.has(key)) {
        this.seen.add(key);
        emit(time, "sensor", `FLEET PICTURE / TRACK ${track.id} / CONTRIBUTORS ${track.contributors.join("+") || "UNKNOWN"} / CUE ONLY`);
      }
    }
    for (const activity of observation.networkActivities) {
      const key = `network:${activity.id}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      emit(activity.time, "network", `FLEET ${activity.network.toUpperCase()} ${activity.kind.toUpperCase()} / ${activity.senderId}${activity.recipientId ? ` -> ${activity.recipientId}` : ""}${activity.trackId ? ` / TRACK ${activity.trackId}` : ""}${activity.delay !== undefined ? ` / DELAY ${activity.delay.toFixed(2)}s` : ""}`);
    }
    for (const assignment of observation.assignments) {
      const state = `${assignment.status}|${assignment.weaponsAway}|${assignment.rejectionReason ?? ""}`;
      if (this.assignmentStates.get(assignment.id) === state) continue;
      const previous = this.assignmentStates.get(assignment.id);
      if (!previous)
        emit(assignment.updatedAt, "fire", `AAWC ASSIGN / ${assignment.shooterId} / TRACK ${assignment.targetId} / ${assignment.requestedShots} x ${assignment.weapon} / ORGANIC ${assignment.localTrackId}`);
      else if (assignment.status === "rejected")
        emit(assignment.updatedAt, "fire", `AAWC REJECT / ${assignment.shooterId} / ${assignment.id} / ${assignment.rejectionReason ?? "UNSPECIFIED"}`);
      else if (assignment.weaponsAway > Number(previous.split("|")[1] ?? 0))
        emit(assignment.updatedAt, "fire", `FLEET WEAPONS AWAY / ${assignment.shooterId} / ${assignment.id} / ${assignment.weaponsAway} x ${assignment.weapon} / GUIDANCE ${assignment.shooterId}`);
      else
        emit(assignment.updatedAt, "fire", `AAWC TASK ${assignment.status.toUpperCase()} / ${assignment.shooterId} / ${assignment.id}`);
      this.assignmentStates.set(assignment.id, state);
    }
    for (const engagement of observation.engagements) {
      const state = `${engagement.status}|${engagement.weaponsCommitted}`;
      if (this.engagementStates.get(engagement.targetId) === state) continue;
      if (this.engagementStates.has(engagement.targetId))
        emit(engagement.updatedAt, "effect", `FLEET ASSESSMENT / TRACK ${engagement.targetId} / ${engagement.status.toUpperCase()} / ${engagement.weaponsCommitted} COMMITTED / PK ${Math.round(engagement.estimatedPk * 100)}%`);
      this.engagementStates.set(engagement.targetId, state);
    }
    return {
      events: events.sort((a, b) => a.time - b.time),
      snapshot: {
        id: observation.id,
        datalinkEra: observation.datalinkEra,
        link11Enabled: observation.link11Enabled,
        formation: observation.formation,
        members: observation.members.map((member) => ({ ...member })),
        tracks: observation.tracks.map((track) => ({ ...track, contributors: [...track.contributors] })),
        assignments: observation.assignments.map((assignment) => ({ ...assignment })),
        engagements: observation.engagements.map((engagement) => ({ ...engagement, shooters: [...engagement.shooters] })),
      },
    };
  }
}
