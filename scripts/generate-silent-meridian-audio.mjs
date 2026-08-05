import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SAMPLE_RATE = 22_050;
const OUTPUT = resolve("public/audio/silent-meridian");
const TAU = Math.PI * 2;
const clamp = (value, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const midi = note => 440 * 2 ** ((note - 69) / 12);

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = Math.imul(state ^ state >>> 15, 1 | state) + 0x6d2b79f5 | 0), ((state ^ state >>> 14) >>> 0) / 4294967296);
}

function track(seconds) {
  return { seconds, left:new Float64Array(Math.floor(seconds * SAMPLE_RATE)), right:new Float64Array(Math.floor(seconds * SAMPLE_RATE)) };
}

function addTone(out, frequency, start, duration, gain, options = {}) {
  const begin = Math.floor(start * SAMPLE_RATE), end = Math.min(out.left.length, Math.floor((start + duration) * SAMPLE_RATE));
  const attack = options.attack ?? .18, release = options.release ?? .7, pan = options.pan ?? 0, vibrato = options.vibrato ?? 0;
  for (let i = begin; i < end; i++) {
    const local = (i - begin) / SAMPLE_RATE, remaining = duration - local;
    const envelope = Math.min(1, local / attack, remaining / release);
    const phase = TAU * frequency * local + Math.sin(TAU * 4.7 * local) * vibrato;
    const value = (Math.sin(phase) + Math.sin(phase * .501) * .055 + Math.sin(phase * 2.003) * .1) * gain * envelope;
    out.left[i] += value * Math.sqrt((1 - pan) * .5);
    out.right[i] += value * Math.sqrt((1 + pan) * .5);
  }
}

function addPulse(out, frequency, at, gain, pan = 0) {
  const duration = .19, begin = Math.floor(at * SAMPLE_RATE), end = Math.min(out.left.length, Math.floor((at + duration) * SAMPLE_RATE));
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SAMPLE_RATE, envelope = Math.exp(-t * 24);
    const value = (Math.sin(TAU * frequency * t) + Math.sin(TAU * frequency * 2.01 * t) * .28) * gain * envelope;
    out.left[i] += value * Math.sqrt((1 - pan) * .5);
    out.right[i] += value * Math.sqrt((1 + pan) * .5);
  }
}

function addNoise(out, seed, gain, lowPass = .025, movement = 0) {
  const rand = random(seed); let l = 0, r = 0;
  for (let i = 0; i < out.left.length; i++) {
    l += ((rand() * 2 - 1) - l) * lowPass;
    r += ((rand() * 2 - 1) - r) * lowPass;
    const pan = Math.sin(i / SAMPLE_RATE * movement) * .35;
    out.left[i] += l * gain * (1 - pan);
    out.right[i] += r * gain * (1 + pan);
  }
}

function addPad(out, notes, start, duration, gain) {
  notes.forEach((note, index) => addTone(out, midi(note), start, duration, gain / notes.length, { attack:2.4, release:2.8, pan:(index / Math.max(1, notes.length - 1) - .5) * .7, vibrato:.025 }));
}

function addPiano(out, note, start, duration, gain, pan = 0) {
  addTone(out, midi(note), start, duration, gain, { attack:.012, release:Math.min(2.5, duration * .8), pan });
  addTone(out, midi(note + 12), start, duration * .72, gain * .16, { attack:.008, release:1.1, pan:pan * .8 });
}

function addCello(out, note, start, duration, gain, pan = -.12) {
  addTone(out, midi(note), start, duration, gain, { attack:.38, release:.72, pan, vibrato:.052 });
  addTone(out, midi(note + 12), start, duration, gain * .22, { attack:.55, release:1.2, pan:pan + .08, vibrato:.05 });
}

function addHorn(out, note, start, duration, gain, pan = .08) {
  addTone(out, midi(note), start, duration, gain, { attack:.46, release:.62, pan, vibrato:.014 });
  addTone(out, midi(note - 12), start, duration, gain * .1, { attack:.5, release:.58, pan:pan * .5 });
}

function addMelody(out, notes, start, beat, gain, instrument = addPiano) {
  let cursor = start;
  for (const [note, beats] of notes) {
    if (note !== null) instrument(out, note, cursor, beat * beats * .96, gain, Math.sin(cursor * .37) * .2);
    cursor += beat * beats;
  }
}

function addProgression(out, chords, bars, barSeconds, gain, celloGain = 0) {
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length], at = bar * barSeconds;
    addPad(out, chord, at, barSeconds + .25, gain * (.92 + (bar % 3) * .04));
    if (celloGain && bar % 2 === 0) addCello(out, chord[0] + 12, at, barSeconds * 1.55, celloGain, -.18);
  }
}

function normalize(out, peak = .82) {
  let maximum = 0;
  for (let i = 0; i < out.left.length; i++) maximum = Math.max(maximum, Math.abs(out.left[i]), Math.abs(out.right[i]));
  const scale = maximum > 0 ? peak / maximum : 1;
  for (let i = 0; i < out.left.length; i++) { out.left[i] *= scale; out.right[i] *= scale; }
  return out;
}

function wav(out) {
  const channels = 2, bits = 16, block = channels * bits / 8, dataBytes = out.left.length * block;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * block, 28); buffer.writeUInt16LE(block, 32); buffer.writeUInt16LE(bits, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0, offset = 44; i < out.left.length; i++, offset += 4) {
    buffer.writeInt16LE(Math.round(clamp(out.left[i]) * 32767), offset);
    buffer.writeInt16LE(Math.round(clamp(out.right[i]) * 32767), offset + 2);
  }
  return buffer;
}

const layers = {
  "polar-bed": () => {
    const out = track(73); addNoise(out, 19881123, .01, .0035, .12);
    const chords = [[38,45,50,53],[34,41,46,50],[41,48,53,57],[36,43,48,52]];
    addProgression(out, chords, 9, 8, .62, .105);
    addMelody(out, [[62,2],[69,1],[68,1],[64,2],[65,2],[62,2],[57,2],[60,2],[64,2]], 1, 1.82, .135, addHorn);
    addMelody(out, [[57,2],[60,1],[62,1],[65,2],[64,2],[null,2],[62,1],[60,1],[57,4]], 38, 1.74, .105, addHorn);
    return normalize(out, .76);
  },
  "link-pulse": () => {
    const out = track(47); addNoise(out, 110011, .01, .08, .4);
    const ostinato = [50,57,53,60,50,57,52,59];
    for (let section = 0; section < 3; section++) ostinato.forEach((note, i) => {
      if (section === 1 && (i === 3 || i === 6)) return;
      addPiano(out, note + (section === 2 && i > 4 ? 2 : 0), section * 15.5 + i * 1.92, 1.5, .15, i % 2 ? .22 : -.22);
    });
    for (let at = .5; at < 47; at += 2.35) if (at < 15 || at > 25) addPulse(out, midi(74), at, .052, Math.sin(at) * .35);
    addProgression(out,[[38,45,50,53],[36,43,48,52],[34,41,46,50]],6,7.8,.27);
    return normalize(out, .62);
  },
  "contact-tension": () => {
    const out = track(43); addNoise(out, 541416, .014, .012, .2);
    addProgression(out,[[38,45,50,53],[34,41,46,50],[41,48,53,57]],6,7.1,.43);
    for(let at=0;at<43;at+=1.18) if (at < 14 || at > 20) addCello(out, [38,34,41][Math.floor(at/14.3)] ?? 38, at, .84, .105, -.32);
    addMelody(out,[[62,1],[64,1],[65,2],[68,1],[65,1],[64,2],[62,1],[60,1],[57,2],[60,1],[62,1],[64,2]],.4,1.02,.17,addPiano);
    addMelody(out,[[57,1],[60,1],[62,2],[null,2],[65,1],[64,1],[62,2],[60,2]],25,.98,.13,addPiano);
    return normalize(out, .7);
  },
  "missile-engagement": () => {
    const out = track(37); addNoise(out, 845, .017, .05, .7);
    const combatChords=[[35,42,47,50],[38,45,50,53],[34,41,46,50],[36,43,48,52]];
    for(let i=0;i<9;i++) addPad(out,combatChords[i%4],i*4.1,4.3,.4);
    for (let at=0;at<37;at+=.55) { if (at > 13 && at < 18) continue; addCello(out,[35,38,34,36][Math.floor(at/9.25)]??35,at,.4,.085,-.45); if(Math.floor(at*2)%5===0)addPulse(out,midi(35),at,.12,-.1); }
    addMelody(out,[[62,1],[69,1],[68,.5],[64,.5],[65,1],[62,1],[69,1],[72,1],[71,1],[68,1],[65,2],[64,1],[65,1],[69,2]],.25,.83,.165,addHorn);
    addMelody(out,[[65,1],[69,1],[72,1],[71,1],[68,2],[null,1],[65,1],[64,1],[62,3]],20,.78,.135,addHorn);
    return normalize(out, .8);
  },
  "total-blackout": () => {
    const out = track(67); addNoise(out, 300720, .014, .0028, .08);
    addProgression(out,[[38,45,50,56],[41,48,53,57],[34,41,46,53]],6,11,.4,.075);
    addMelody(out,[[62,2],[null,1],[57,1],[56,2],[52,2],[53,2],[null,1],[50,1],[53,2],[57,2]],2,1.7,.21,addPiano);
    addMelody(out,[[50,2],[null,2],[53,1],[57,1],[56,2],[52,2],[null,2],[50,4]],38,1.55,.15,addPiano);
    return normalize(out, .68);
  },
  "recovery": () => {
    const out = track(61); addNoise(out, 9601080, .012, .008, .14);
    const chords=[[38,45,50,53],[34,41,46,50],[41,48,53,57],[36,43,48,52]];
    addProgression(out,chords,8,7.55,.54,.09);
    addMelody(out,[[62,2],[69,1],[68,1],[64,2],[65,2],[62,1],[65,1],[69,2],[72,2],[69,2],[65,1],[64,1],[62,2],[57,2]],1,1.7,.16,addHorn);
    addMelody(out,[[50,1],[57,1],[53,1],[57,1],[50,1],[57,1],[52,1],[59,1]],30,.98,.1,addPiano);
    addMelody(out,[[65,2],[64,1],[62,1],[60,2],[57,2],[62,2],[null,2],[65,4]],43,1.05,.105,addHorn);
    return normalize(out,.76);
  },
};

await mkdir(OUTPUT, { recursive:true });
const manifest = { id:"silent-meridian", title:"静默子午线 / Silent Meridian", sampleRate:SAMPLE_RATE, generatedAt:new Date().toISOString(), layers:{} };
for (const [name, create] of Object.entries(layers)) {
  const audio = create(), file = `${name}.wav`;
  await writeFile(resolve(OUTPUT, file), wav(audio));
  manifest.layers[name] = { file, seconds:audio.seconds };
}
await writeFile(resolve(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${Object.keys(layers).length} original Silent Meridian layers in ${OUTPUT}`);
