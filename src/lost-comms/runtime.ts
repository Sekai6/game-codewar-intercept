import { LOST_COMMS_DOCTRINES } from "./doctrine-catalog.js";
import type { LostCommsDoctrineId, LostCommsState, LostCommsTransition, LostCommsUpdate } from "./types.js";

export class LostCommsRuntime {
  private readonly states = new Map<string, LostCommsState>();
  private readonly belowSince = new Map<string, number>();

  register(platformId: string, doctrineId: LostCommsDoctrineId, time = 0): LostCommsState {
    const doctrine = LOST_COMMS_DOCTRINES[doctrineId];
    const state: LostCommsState = { platformId, doctrineId, enteredAt:null,lastCommandAt:time,lastNetworkTrackAt:time,autonomyLevel:doctrine.autonomyLevel,commandAssumed:false,connected:true,recoveryStartedAt:null };
    this.states.set(platformId,state); return state;
  }

  update(platformId: string, input: LostCommsUpdate): LostCommsTransition | null {
    const state = this.states.get(platformId); if (!state) throw new Error(`Lost-comms platform not registered: ${platformId}`);
    const doctrine = LOST_COMMS_DOCTRINES[state.doctrineId];
    if (input.commandReceived) state.lastCommandAt = input.time;
    if (input.networkTrackReceived) state.lastNetworkTrackAt = input.time;
    if (state.connected) {
      if (input.linkQuality < doctrine.enterBelowQuality) {
        const since = this.belowSince.get(platformId) ?? input.time; this.belowSince.set(platformId,since);
        if (input.time - since >= doctrine.enterDelay) {
          state.connected=false; state.enteredAt=input.time; state.recoveryStartedAt=null;
          return {platformId,kind:"entered",time:input.time,doctrineId:state.doctrineId};
        }
      } else this.belowSince.delete(platformId);
      return null;
    }
    if (input.linkQuality >= doctrine.restoreAboveQuality) {
      if (state.recoveryStartedAt === null) {
        state.recoveryStartedAt=input.time;
        return {platformId,kind:"recovering",time:input.time,doctrineId:state.doctrineId};
      }
      if (input.time-state.recoveryStartedAt >= doctrine.restoreDelay) {
        state.connected=true; state.enteredAt=null; state.recoveryStartedAt=null; this.belowSince.delete(platformId);
        return {platformId,kind:"restored",time:input.time,doctrineId:state.doctrineId};
      }
    } else state.recoveryStartedAt=null;
    return null;
  }

  state(platformId: string) { return this.states.get(platformId); }
  all() { return [...this.states.values()].map(state => ({...state})); }
  reset() { this.states.clear(); this.belowSince.clear(); }
}
