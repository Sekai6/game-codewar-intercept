import type { PropagationChannel, PropagationContext, PropagationEffect, SpaceWeatherSnapshot } from "./types.js";

const clamp01 = (value:number) => Math.max(0,Math.min(1,value));
function hash01(value:string) { let hash=2166136261; for(let i=0;i<value.length;i++) {
  hash^=value.charCodeAt(i); hash=Math.imul(hash,16777619); } return (hash>>>0)/0xffffffff; }

interface ChannelProfile { reliability:(s:SpaceWeatherSnapshot)=>number; sensitivity:number; delay:number; clock:number; }
const CHANNELS: Record<PropagationChannel,ChannelProfile> = {
  link11:{reliability:s=>Math.min(s.hfAvailability,s.vhfUhfReliability),sensitivity:1.10,delay:3.2,clock:.24},
  link16:{reliability:s=>s.vhfUhfReliability,sensitivity:.78,delay:.35,clock:.12},
  hf:{reliability:s=>s.hfAvailability,sensitivity:1.15,delay:2.4,clock:.35},
  "vhf-uhf":{reliability:s=>s.vhfUhfReliability,sensitivity:.82,delay:.55,clock:.16},
  satellite:{reliability:s=>s.satelliteReliability,sensitivity:1.05,delay:.7,clock:.28},
  "soviet-gci":{reliability:s=>s.vhfUhfReliability*.72+s.hfAvailability*.28,sensitivity:.92,delay:1.5,clock:.22},
  "soviet-maritime-c2":{reliability:s=>s.hfAvailability*.58+s.satelliteReliability*.42,sensitivity:1.08,delay:2.8,clock:.32},
};

/** Pure deterministic adapter; callers retain their own terminal/range/capacity rules. */
export function evaluatePropagation(snapshot:SpaceWeatherSnapshot, context:PropagationContext):PropagationEffect {
  const profile=CHANNELS[context.channel]; const range=clamp01(context.rangeRatio??0);
  const environmental=clamp01(profile.reliability(snapshot)*(1-snapshot.ionosphericScintillation*.22*profile.sensitivity));
  const rangePenalty=range*range*.18;
  const success=clamp01((context.baseSuccessProbability??1)*environmental-rangePenalty);
  const sample=hash01(`${snapshot.presetId}:${Math.floor(snapshot.time*4)}:${context.channel}:${context.messageId}:${context.senderId}:${context.recipientId}`);
  const outOfRange=(context.rangeRatio??0)>1;
  const dropped=outOfRange||sample>success;
  const quality=clamp01((context.baseQuality??1)*(.35+.65*environmental)*(1-snapshot.magneticDisturbance*.12));
  const addedDelay=profile.delay*(1-environmental)*(1+snapshot.ionosphericScintillation*2.5)+range*profile.delay*.25;
  const reason=outOfRange?"out-of-range":dropped?"space-weather-loss":environmental<.78?"degraded":"nominal";
  return { channel:context.channel, available:!dropped&&environmental>.01,
    qualityMultiplier:quality, delaySeconds:(context.baseDelaySeconds??0)+addedDelay,
    successProbability:success, dropped, clockErrorSeconds:profile.clock*snapshot.magneticDisturbance*(.5+sample),
    uncertaintyMultiplier:1+(1-quality)*2.5+addedDelay*.08, reason };
}
