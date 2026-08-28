import type { AirPlatformInstance, AirTrack } from "../air/types.js";
import type { ArmEmitterRuntime } from "./emitter-runtime.js";

/**
 * SEAD release gate.  An ARM may only be released against a confirmed
 * emitter track; a generic platform track is deliberately insufficient.
 */
export function armReleaseAuthorization(input: {
  aircraft: AirPlatformInstance;
  track: AirTrack;
  emitters: ArmEmitterRuntime;
  time: number;
}): { allowed: true; emitterId: string } | { allowed: false; reason: string } {
  if (input.aircraft.mission !== "sead")
    return { allowed: false, reason: "MISSION_NOT_SEAD" };
  const passive = input.track.passive;
  const emitterId = passive?.emitterId;
  if (!emitterId) return { allowed: false, reason: "NO_EMITTER_TRACK" };
  const emitter = input.emitters.emitters.get(emitterId);
  if (!emitter) return { allowed: false, reason: "EMITTER_UNKNOWN" };
  if (!emitter.active && !passive?.emitterType)
    return { allowed: false, reason: "EMITTER_NOT_CONFIRMED" };
  if (input.track.quality < 0.28)
    return { allowed: false, reason: "EMITTER_TRACK_LOW_QUALITY" };
  if (input.time - input.track.lastUpdate > 12)
    return { allowed: false, reason: "EMITTER_TRACK_EXPIRED" };
  return { allowed: true, emitterId };
}
