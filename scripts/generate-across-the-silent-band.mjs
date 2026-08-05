import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SR = 44_100;
const LENGTH = 300;
const BPM = 117.5;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const TAU = Math.PI * 2;
const OUTPUT = resolve("public/audio/silent-meridian");
const left = new Float32Array(SR * LENGTH);
const right = new Float32Array(SR * LENGTH);
const midi = note => 440 * 2 ** ((note - 69) / 12);
const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

function rng(seed) {
  let state = seed >>> 0;
  return () => ((state = Math.imul(state ^ state >>> 15, 1 | state) + 0x6d2b79f5 | 0), ((state ^ state >>> 14) >>> 0) / 4294967296);
}

const TABLE_SIZE = 4096;
function table(harmonicGain) {
  const data = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) {
    const phase = TAU * i / TABLE_SIZE;
    for (let harmonic = 1; harmonic <= 28; harmonic++) data[i] += Math.sin(phase * harmonic) * harmonicGain(harmonic);
  }
  let peak = 0;
  for (const value of data) peak = Math.max(peak, Math.abs(value));
  for (let i = 0; i < data.length; i++) data[i] /= peak || 1;
  return data;
}

const waves = {
  sine: table(h => h === 1 ? 1 : 0),
  warmSaw: table(h => (1 / h) * Math.exp(-h * .075)),
  darkPulse: table(h => (h % 2 ? 1 : .22) / h * Math.exp(-h * .11)),
  bowed: table(h => ([1,.34,.2,.12,.075,.046,.03,.019][h - 1] ?? .012 / h) * Math.exp(-h * .045)),
  choir: table(h => ([1,.22,.41,.09,.2,.045,.085,.02][h - 1] ?? 0) * Math.exp(-h * .055)),
  reed: table(h => (h % 2 ? .82 : .31) / h * Math.exp(-h * .14)),
  glass: table(h => [0,1,.08,.31,.025,.14,.01,.06][h] ?? 0),
};

function sampleTable(data, phase) {
  const position = phase / TAU * TABLE_SIZE;
  const index = Math.floor(position) & (TABLE_SIZE - 1);
  const fraction = position - Math.floor(position);
  return data[index] * (1 - fraction) + data[(index + 1) & (TABLE_SIZE - 1)] * fraction;
}

function voice(note, start, duration, gain, options = {}) {
  const frequency = midi(note) * 2 ** ((options.detune ?? 0) / 1200);
  const begin = Math.max(0, Math.floor(start * SR));
  const end = Math.min(left.length, Math.floor((start + duration) * SR));
  const attack = options.attack ?? .02, release = options.release ?? .25, pan = options.pan ?? 0;
  const wave = waves[options.wave ?? "warmSaw"];
  const cutoffStart = options.cutoffStart ?? .1, cutoffEnd = options.cutoffEnd ?? cutoffStart;
  const vibrato = options.vibrato ?? 0, tremolo = options.tremolo ?? 0;
  const highpass = options.highpass ?? 0;
  let phase = 0, filtered = 0, lowBand = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, progress = t / duration;
    phase += TAU * frequency * (1 + Math.sin(TAU * 5.05 * t) * vibrato) / SR;
    if (phase >= TAU) phase -= TAU;
    const raw = sampleTable(wave, phase);
    const cutoff = cutoffStart + (cutoffEnd - cutoffStart) * (.5 - .5 * Math.cos(Math.PI * progress));
    filtered += (raw - filtered) * cutoff;
    const env = Math.min(1, t / Math.max(.001, attack), (duration - t) / Math.max(.001, release));
    const movement = 1 - tremolo + tremolo * (.5 + .5 * Math.sin(TAU * .19 * t));
    lowBand += (filtered - lowBand) * highpass;
    const colored = highpass > 0 ? filtered - lowBand : filtered;
    const value = colored * env * movement * gain;
    left[i] += value * Math.sqrt((1 - pan) * .5);
    right[i] += value * Math.sqrt((1 + pan) * .5);
  }
}

function pad(chord, start, duration, gain, brightness = .055) {
  chord.forEach((note, index) => {
    const pan = (index / Math.max(1, chord.length - 1) - .5) * .78;
    voice(note, start, duration, gain / chord.length, {
      wave:"bowed", attack:1.35, release:2.8,
      cutoffStart:.1 + brightness * 1.2, cutoffEnd:.19 + brightness * 1.55,
      detune:index % 2 ? 3 : -3, pan, tremolo:.035,
      highpass:note >= 57 ? .0075 : 0,
    });
    voice(note + 12, start + .06, duration - .06, gain / chord.length * .075, {
      wave:"bowed", attack:1.8, release:2.5,
      cutoffStart:.38, cutoffEnd:.52, detune:index % 2 ? -2 : 2,
      pan:-pan * .55, tremolo:.02, highpass:.18,
    });
  });
}

function pulsePad(chord, start, bars, gain, brightness = .085) {
  const voicing = [chord[0], ...chord.slice(-3)];
  for (let bar = 0; bar < bars; bar += 2) {
    voicing.forEach((note, index) => voice(note, start + bar * BAR, BAR * 1.22, gain / voicing.length, {
      wave:"bowed", attack:.32, release:.58,
      cutoffStart:.13 + brightness * .72, cutoffEnd:.22 + brightness,
      detune:index % 2 ? 2 : -2,
      pan:(index / Math.max(1, voicing.length - 1) - .5) * .72,
      tremolo:.035, highpass:note >= 57 ? .008 : 0,
    }));
  }
}

function brass(note, start, duration, gain, pan = 0, opening = .11) {
  voice(note, start, duration, gain, { wave:"reed", attack:.18, release:.44, cutoffStart:.045, cutoffEnd:opening, vibrato:.0007, pan });
  voice(note - 12, start, duration, gain * .045, { wave:"sine", attack:.24, release:.4, cutoffStart:.06, cutoffEnd:.04, pan:pan * .5 });
}

function themeLead(note, start, duration, gain, pan = 0) {
  voice(note, start, duration, gain, {
    wave:"bowed", attack:.075, release:.42,
    cutoffStart:.17, cutoffEnd:.31, vibrato:.00115,
    pan, tremolo:.018, highpass:.0045,
  });
  voice(note + 12, start + .018, duration * .96, gain * .11, {
    wave:"bowed", attack:.055, release:.36,
    cutoffStart:.42, cutoffEnd:.58, vibrato:.0007,
    pan:-pan * .45, highpass:.16,
  });
}

function distantThemeLead(note, start, duration, gain, pan = 0) {
  voice(note, start, duration, gain, {
    wave:"choir", attack:.24, release:.75,
    cutoffStart:.12, cutoffEnd:.235, vibrato:.00075,
    pan, tremolo:.04, highpass:.006,
  });
  voice(note + 12, start + .03, duration * .82, gain * .07, {
    wave:"glass", attack:.012, release:.35,
    cutoffStart:.12, cutoffEnd:.065, pan:-pan * .35, highpass:.012,
  });
}

function lowString(note, start, duration, gain, pan = 0) {
  voice(note, start, duration, gain, {
    wave:"bowed", attack:.012, release:.12,
    cutoffStart:.038, cutoffEnd:.072, pan, tremolo:.01,
  });
}

function choirPad(chord, start, duration, gain) {
  const upper = chord.slice(-4);
  upper.forEach((note, index) => voice(note + 12, start, duration, gain / upper.length, {
    wave:"choir", attack:2.1, release:3.4,
    cutoffStart:.11, cutoffEnd:.21,
    detune:index % 2 ? 3 : -3,
    pan:(index / Math.max(1, upper.length - 1) - .5) * .8,
    tremolo:.055, highpass:.009,
  }));
}

function hornAccent(chord, start, duration, gain) {
  chord.slice(-3).forEach((note, index) => brass(
    note,
    start + index * .018,
    duration,
    gain / 3,
    (index - 1) * .28,
    .095,
  ));
}

function glass(note, start, duration, gain, pan = 0) {
  voice(note, start, duration, gain, { wave:"glass", attack:.008, release:Math.min(duration * .82, 1.8), cutoffStart:.24, cutoffEnd:.08, pan });
}

function bass(note, start, duration, gain, open = .07) {
  voice(note, start, duration, gain, { wave:"darkPulse", attack:.018, release:.16, cutoffStart:open * .55, cutoffEnd:open, pan:-.04 });
}

function kick(at, gain = .25) {
  const begin = Math.floor(at * SR), end = Math.min(left.length, begin + Math.floor(.42 * SR));
  let phase = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, frequency = 46 + 77 * Math.exp(-t * 25);
    phase += TAU * frequency / SR;
    const value = Math.sin(phase) * Math.exp(-t * 12.5) * gain;
    left[i] += value * .707; right[i] += value * .707;
  }
}

function snare(at, gain = .12) {
  const rand = rng(Math.floor(at * 9817) + 71), begin = Math.floor(at * SR), end = Math.min(left.length, begin + Math.floor(.31 * SR));
  let low = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, noise = rand() * 2 - 1;
    low += (noise - low) * .18;
    const high = noise - low;
    const value = (high * .72 + Math.sin(TAU * 174 * t) * .18) * Math.exp(-t * 16) * gain;
    left[i] += value * .66; right[i] += value * .75;
  }
}

function tom(at, note = 43, gain = .13, pan = 0) {
  const begin = Math.floor(at * SR), end = Math.min(left.length, begin + Math.floor(.5 * SR));
  let phase = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, frequency = midi(note) * (1 + .16 * Math.exp(-t * 15));
    phase += TAU * frequency / SR;
    const value = (Math.sin(phase) + Math.sin(phase * 2.01) * .13) * Math.exp(-t * 8.7) * gain;
    left[i] += value * Math.sqrt((1 - pan) * .5); right[i] += value * Math.sqrt((1 + pan) * .5);
  }
}

function noiseSweep(start, duration, gain) {
  const rand = rng(Math.floor(start * 7717) + 991), begin = Math.floor(start * SR), end = Math.min(left.length, Math.floor((start + duration) * SR));
  let previous = 0, low = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, progress = t / duration, noise = rand() * 2 - 1;
    low += (noise - low) * (.008 + progress * .16);
    const high = low - previous; previous = low;
    const envelope = Math.sin(Math.PI * progress) ** .7;
    left[i] += high * gain * envelope * (.8 + progress * .35);
    right[i] += high * gain * envelope * (1.12 - progress * .25);
  }
}

function hat(at, gain = .026, pan = .15) {
  const rand = rng(Math.floor(at * 17777) + 5), begin = Math.floor(at * SR), end = Math.min(left.length, begin + Math.floor(.075 * SR));
  let previous = 0;
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / SR, noise = rand() * 2 - 1, high = noise - previous; previous = noise;
    const value = high * Math.exp(-t * 58) * gain;
    left[i] += value * Math.sqrt((1 - pan) * .5); right[i] += value * Math.sqrt((1 + pan) * .5);
  }
}

function beatGrid(start, end, amount, broken = false) {
  let step = 0;
  for (let at = start; at < end; at += BEAT / 2, step++) {
    if (broken && (step % 19 === 13 || step % 29 === 22)) continue;
    if (step % 8 === 0 || step % 8 === 5) kick(at, .21 * amount);
    if (step % 8 === 4) snare(at, .105 * amount);
    hat(at, .022 * amount, step % 2 ? .18 : -.12);
  }
}

function epicBeatGrid(start, end, amount = 1) {
  let step = 0;
  for (let at = start; at < end; at += BEAT / 2, step++) {
    if (step % 2 === 0) kick(at, .19 * amount);
    if (step % 8 === 4) snare(at, .15 * amount);
    hat(at, (step % 2 ? .033 : .024) * amount, step % 2 ? .3 : -.2);
    if (step > 0 && step % 64 >= 58) tom(at, [43,45,48,50,53,55][step % 64 - 58], .085 * amount, (step % 64 - 60) * .18);
  }
}

function sequence(pattern, start, end, gain, opening = .07, omissions = () => false) {
  let step = 0;
  for (let at = start; at < end; at += BEAT / 2, step++) {
    if (omissions(step)) continue;
    const note = pattern[step % pattern.length];
    bass(note, at, BEAT * .38, gain, opening * (.86 + .14 * Math.sin(step * .23)));
  }
}

function lowStringSequence(pattern, start, end, gain, options = {}) {
  const stepLength = options.stepLength ?? BEAT / 2;
  const omission = options.omission ?? (() => false);
  let step = 0;
  for (let at = start; at < end; at += stepLength, step++) {
    if (omission(step)) continue;
    lowString(
      pattern[step % pattern.length],
      at,
      stepLength * (step % 4 === 0 ? .82 : .58),
      gain * (step % 4 === 0 ? 1 : .72),
      Math.sin(step * .41) * .08,
    );
  }
}

function fleetBeatGrid(start, end, amount = 1, intensity = .7) {
  let halfBeat = 0;
  for (let at = start; at < end; at += BEAT / 2, halfBeat++) {
    const withinBar = halfBeat % 8;
    const bar = Math.floor(halfBeat / 8);
    if (withinBar === 0) tom(at, bar % 4 === 0 ? 38 : 43, .12 * amount, -.04);
    if (intensity > .45 && (withinBar === 2 || withinBar === 6)) snare(at, .044 * amount * intensity);
    if (intensity > .62 && withinBar % 2 === 1) hat(at, .011 * amount * intensity, withinBar % 4 === 1 ? -.18 : .2);
    if (withinBar === 4 && bar % 2 === 1) kick(at, .105 * amount);
  }
}

function midSequence(pattern, start, end, gain, options = {}) {
  const stepLength = options.stepLength ?? BEAT / 4;
  const offset = options.offset ?? 0;
  const pan = options.pan ?? 0;
  const omission = options.omission ?? (() => false);
  let step = 0;
  for (let at = start + offset; at < end; at += stepLength, step++) {
    if (omission(step)) continue;
    const note = pattern[step % pattern.length];
    voice(note, at, stepLength * .68, gain * (step % 4 === 0 ? 1 : .76), {
      wave:"darkPulse", attack:.006, release:.075, cutoffStart:.075, cutoffEnd:.16,
      pan:pan + Math.sin(step * .63) * .12,
    });
  }
}

function chaosBeatGrid(start, end, amount = 1) {
  let step = 0;
  for (let at = start; at < end; at += BEAT / 4, step++) {
    const withinBar = step % 16;
    const bar = Math.floor(step / 16);
    if (withinBar === 0 || withinBar === 8 || (bar % 2 === 1 && withinBar === 14)) kick(at, .205 * amount * (withinBar === 0 ? 1.12 : 1));
    if (withinBar === 4 || withinBar === 12) snare(at, .205 * amount);
    if (withinBar % 2 === 1) hat(at, .07 * amount, withinBar % 4 === 1 ? -.32 : .34);
  }
}

function cyclicAccentSequence(pattern, start, end, gain, options) {
  const stepLength = options.stepLength ?? BEAT / 2;
  const accents = new Set(options.accents);
  const period = options.period;
  const pan = options.pan ?? 0;
  const offset = options.offset ?? 0;
  let step = 0;
  for (let at = start + offset; at < end; at += stepLength, step++) {
    const accented = accents.has(step % period);
    const note = pattern[step % pattern.length];
    voice(note, at, stepLength * (accented ? .7 : .46), gain * (accented ? 1 : .38), {
      wave:"darkPulse", attack:.005, release:.065,
      cutoffStart:accented ? .1 : .065, cutoffEnd:accented ? .19 : .12,
      pan:pan + Math.sin(step * .47) * .08,
    });
  }
}

function linkPulse(start, end, spacingBars = 2, gain = .035, disrupted = false) {
  let index = 0;
  for (let at = start; at < end; at += BAR * spacingBars, index++) {
    const jitter = disrupted ? Math.sin(index * 2.31) * BEAT * .22 : 0;
    glass(81, at + jitter, BEAT * .45, gain, -.58);
    if (!disrupted || index % 3 !== 1) glass(86, at + BEAT * (disrupted ? 1.34 : 1), BEAT * .36, gain * .72, .58);
  }
}

function noiseField(start, end, gain, seed, color = .008) {
  const rand = rng(seed), begin = Math.floor(start * SR), finish = Math.min(left.length, Math.floor(end * SR));
  let l = 0, r = 0;
  for (let i = begin; i < finish; i++) {
    l += ((rand() * 2 - 1) - l) * color;
    r += ((rand() * 2 - 1) - r) * color;
    const t = i / SR, drift = .55 + .45 * Math.sin(TAU * .031 * t) ** 2;
    left[i] += l * gain * drift; right[i] += r * gain * drift;
  }
}

function motif(notes, start, beat, gain, transpose = 0, instrument = themeLead) {
  let cursor = start;
  for (const [note, beats] of notes) {
    if (note !== null) instrument(note + transpose, cursor, beat * beats * .92, gain, Math.sin(cursor * .37) * .13);
    cursor += beat * beats;
  }
}

function renderTheme(events, start, gain, options = {}) {
  const transpose = options.transpose ?? 0;
  const timeScale = options.timeScale ?? 1;
  const beatOffset = options.beatOffset ?? 0;
  const instrument = options.instrument ?? themeLead;
  const endBeat = options.endBeat ?? Infinity;
  const startBeat = options.startBeat ?? 0;
  for (const event of events) {
    if (event.beat < startBeat || event.beat >= endBeat) continue;
    const at = start + (event.beat - startBeat + beatOffset) * BEAT * timeScale;
    const duration = event.duration * BEAT * timeScale * .94;
    instrument(event.note + transpose, at, duration, gain * (event.accent ?? 1), event.pan ?? 0);
  }
}

function signalLead(note, start, duration, gain, pan = 0) {
  voice(note, start, duration, gain, {
    wave:"darkPulse", attack:.024, release:.24,
    cutoffStart:.12, cutoffEnd:.24, vibrato:.0005, pan, highpass:.005,
  });
  voice(note + 12, start + .018, duration * .58, gain * .055, {
    wave:"glass", attack:.008, release:.18,
    cutoffStart:.16, cutoffEnd:.09, pan:-pan * .45,
  });
}

const H_DM9 = [38,45,50,53,57,64];
const H_C_D = [38,43,48,52,55,62];
const H_BB_D = [38,46,50,53,57,62];
const H_EB_D = [38,46,51,55,58,65];
const H_ASUS_B9 = [45,52,55,58,61,64];
const H_GM9 = [43,50,55,58,62,69];
const H_F_A = [45,48,53,57,60,67];
const H_TENSION = [38,45,50,55,58,61];
const H_OPEN = [38,45,50,52,57,62];

// Original sixteen-bar fleet theme. The D-A-Bb-A opening cell is the audible
// identity; four-bar breaths, an eight-bar half cadence, and a single A5 peak
// give it a real phrase arc instead of a string of procedural stingers.
const FLEET_THEME = [
  { beat:0, note:62, duration:1.5, accent:1.04 },
  { beat:1.5, note:69, duration:.5 },
  { beat:2, note:70, duration:1, accent:1.06 },
  { beat:3, note:69, duration:1 },
  { beat:4, note:65, duration:2 },
  { beat:6, note:67, duration:1 },
  { beat:7, note:69, duration:1 },
  { beat:8, note:72, duration:1.5, accent:1.05 },
  { beat:9.5, note:74, duration:.5 },
  { beat:10, note:72, duration:1 },
  { beat:11, note:69, duration:1 },
  { beat:12, note:67, duration:3, accent:1.04 },
  { beat:16, note:65, duration:1 },
  { beat:17, note:69, duration:1 },
  { beat:18, note:74, duration:2, accent:1.08 },
  { beat:20, note:76, duration:2 },
  { beat:22, note:74, duration:1 },
  { beat:23, note:72, duration:1 },
  { beat:24, note:70, duration:1.5 },
  { beat:25.5, note:69, duration:.5 },
  { beat:26, note:67, duration:1 },
  { beat:27, note:65, duration:1 },
  { beat:28, note:69, duration:3, accent:1.08 },
  { beat:32, note:62, duration:1 },
  { beat:33, note:65, duration:1 },
  { beat:34, note:69, duration:1 },
  { beat:35, note:72, duration:1 },
  { beat:36, note:77, duration:2, accent:1.08 },
  { beat:38, note:76, duration:1 },
  { beat:39, note:74, duration:1 },
  { beat:40, note:72, duration:1.5 },
  { beat:41.5, note:70, duration:.5 },
  { beat:42, note:69, duration:1 },
  { beat:43, note:67, duration:1 },
  { beat:44, note:73, duration:3, accent:1.08 },
  { beat:48, note:74, duration:1.5 },
  { beat:49.5, note:77, duration:.5 },
  { beat:50, note:81, duration:1, accent:1.14 },
  { beat:51, note:79, duration:1 },
  { beat:52, note:77, duration:2 },
  { beat:54, note:76, duration:1 },
  { beat:55, note:72, duration:1 },
  { beat:56, note:70, duration:1 },
  { beat:57, note:69, duration:1 },
  { beat:58, note:65, duration:1 },
  { beat:59, note:67, duration:1 },
  { beat:60, note:74, duration:4, accent:1.12 },
];

const signalFragment = [[74,.5],[72,.5],[69,1],[null,.5],[76,.5],[72,1],[67,2],[null,2]];

const BLACKOUT_AT = BAR * 86;
const RECONNECT_AT = BAR * 126;
const AFTERMATH_AT = BAR * 138;

noiseField(0, BAR * 85.75, .0048, 19881123, .0045);
noiseField(BLACKOUT_AT, LENGTH, .0058, 300720, .0055);

// I. FLEET UNDER THE AURORA (0:00–0:33): state the full theme at once.
// Strings and synth carry the melody; horns only mark the two large cadences.
for (const [bar,bars,chord,gain,bright] of [
  [0,2,H_DM9,.245,.052], [2,2,H_C_D,.248,.055],
  [4,2,H_BB_D,.252,.058], [6,1,H_EB_D,.248,.058],
  [7,1,H_ASUS_B9,.242,.056], [8,2,H_DM9,.258,.061],
  [10,2,H_GM9,.26,.063], [12,2,H_BB_D,.264,.065],
  [14,1,H_ASUS_B9,.25,.061], [15,1,H_OPEN,.27,.064],
]) pad(chord, BAR * bar, BAR * (bars + .14), gain, bright);
choirPad(H_DM9, BAR * 8, BAR * 2.1, .038);
choirPad(H_GM9, BAR * 10, BAR * 2.1, .04);
choirPad(H_BB_D, BAR * 12, BAR * 2.1, .043);
choirPad(H_OPEN, BAR * 15, BAR * 1.15, .047);
tom(.04, 38, .19, 0); kick(.04, .14);
noiseSweep(.05, BAR * 1.15, .045);
lowStringSequence([38,45,50,45,38,43,48,43,38,46,50,46,45,52,55,52], 0, BAR * 16, .026, {
  omission:step => step < 16 ? step % 2 === 1 : false,
});
fleetBeatGrid(0, BAR * 16, .76, .66);
renderTheme(FLEET_THEME, BEAT * .08, .114, { instrument:themeLead });
hornAccent(H_ASUS_B9, BAR * 7 + BEAT * 2.9, BEAT * .95, .058);
hornAccent(H_OPEN, BAR * 15 + BEAT * 2.8, BEAT * 1.05, .068);
linkPulse(BAR * 12, BAR * 16, 4, .016, false);

// II. LINK ORDER (0:33–1:22): the fleet theme becomes radio-sized fragments.
pad(H_EB_D, BAR * 16, BAR * 8.1, .245, .052);
pad(H_C_D, BAR * 24, BAR * 8.1, .25, .056);
pad(H_DM9, BAR * 32, BAR * 8.1, .255, .06);
beatGrid(BAR * 16, BAR * 40, .5);
lowStringSequence([38,45,50,45,43,48,52,48], BAR * 16 + BEAT / 2, BAR * 40, .023, {
  omission:step => step % 8 === 7,
});
linkPulse(BAR * 16, BAR * 40, 2, .029, false);
renderTheme(FLEET_THEME, BAR * 20, .056, { endBeat:8, instrument:distantThemeLead });
renderTheme(FLEET_THEME, BAR * 28, .06, { startBeat:8, endBeat:16, instrument:themeLead });
renderTheme(FLEET_THEME, BAR * 36, .058, { endBeat:8, transpose:12, instrument:distantThemeLead });

// III. FLARE DRIFT (1:22–2:19): recognisable answers arrive late and displaced.
pad(H_GM9, BAR * 40, BAR * 7.1, .26, .058);
pad(H_EB_D, BAR * 47, BAR * 7.1, .262, .061);
pad(H_DM9, BAR * 54, BAR * 2.1, .263, .061);
pad(H_GM9, BAR * 56, BAR * 2.1, .264, .063);
pad(H_BB_D, BAR * 58, BAR * 2.1, .265, .064);
pad(H_ASUS_B9, BAR * 60, BAR * 1.1, .258, .061);
pad(H_OPEN, BAR * 61, BAR * 1.1, .266, .063);
pad(H_TENSION, BAR * 62, BAR * 6.1, .25, .058);
beatGrid(BAR * 40, BAR * 54, .54, true);
beatGrid(BAR * 62, BAR * 68, .5, true);
fleetBeatGrid(BAR * 54, BAR * 62, .76, .66);
lowStringSequence([38,45,50,45,43,50,55,50], BAR * 40 + BEAT / 2, BAR * 54, .024, {
  omission:step => step % 13 === 9 || step % 17 === 14,
});
lowStringSequence([38,45,50,45,38,43,48,43,38,46,50,46,45,52,55,52], BAR * 54, BAR * 62, .026);
lowStringSequence([38,45,50,45,43,50,55,50], BAR * 62, BAR * 68, .022, {
  omission:step => step % 13 === 9 || step % 17 === 14,
});
midSequence([62,65,69,67,64,69,65,72], BAR * 48, BAR * 54, .017, { stepLength:BEAT/2, offset:BEAT*.18, pan:.36, omission:step=>step%11===7 });
midSequence([62,65,69,67,64,69,65,72], BAR * 62, BAR * 68, .015, { stepLength:BEAT/2, offset:BEAT*.18, pan:.36, omission:step=>step%11===7 });
linkPulse(BAR * 40, BAR * 68, 2, .026, true);
choirPad(H_DM9, BAR * 54, BAR * 2.1, .038);
choirPad(H_GM9, BAR * 56, BAR * 2.1, .04);
choirPad(H_BB_D, BAR * 58, BAR * 2.1, .043);
choirPad(H_OPEN, BAR * 61, BAR * 1.15, .047);
renderTheme(FLEET_THEME, BAR * 44, .049, { startBeat:16, endBeat:32, transpose:-12, instrument:distantThemeLead });
renderTheme(FLEET_THEME, BAR * 54, .112, { startBeat:32, endBeat:64, instrument:themeLead });
renderTheme(FLEET_THEME, BAR * 64, .046, { endBeat:8, transpose:12, instrument:distantThemeLead });

// IV. LOSS OF COMMON PICTURE (2:19–2:47): cells survive, phrase endings do not.
pad(H_TENSION, BAR * 68, BAR * 7.1, .255, .057);
pad(H_DM9, BAR * 75, BAR * 7.1, .238, .051);
beatGrid(BAR * 68, BAR * 72, .36, true);
lowStringSequence([38,45,50,45,46,41,48,43], BAR * 68 + BEAT / 2, BAR * 72, .018, {
  omission:step => step%7===4 || step%9===7,
});
midSequence([74,72,69,76,72,67,77,72], BAR * 70, BAR * 72, .014, { stepLength:BEAT/4, pan:.22, omission:step=>step%7!==0 });
linkPulse(BAR * 68, BAR * 76, 2, .021, true);
renderTheme(FLEET_THEME, BAR * 70, .048, { endBeat:16, timeScale:.72, instrument:distantThemeLead });
motif(signalFragment, BAR * 77, BEAT * .76, .046, 0, signalLead);

// V. CARRIER FRACTURE (2:47–2:55): stutter, then one beat of real vacuum.
pad(H_TENSION, BAR * 82, BAR * 3.75, .19, .032);
for (const [bar,note,pan] of [[82,62,-.7],[82.75,69,.62],[83.5,70,-.35],[84.25,69,.72],[85,62,-.58]]) {
  glass(note + 12, BAR * bar, BEAT * .2, .019, pan);
}
noiseSweep(BAR * 82.5, BAR * 3.2, .112);

// VI. TOTAL BLACKOUT (2:55–4:17): incompatible local clocks accelerate.
// The main melody is kept in front: warning, absence, then a complete statement.
kick(BLACKOUT_AT, .31); tom(BLACKOUT_AT, 43, .14, 0);
pulsePad(H_DM9, BLACKOUT_AT, 8, .205, .075);
pulsePad(H_EB_D, BAR * 94, 8, .21, .08);
pulsePad(H_BB_D, BAR * 102, 8, .215, .085);
pulsePad(H_DM9, BAR * 110, 2, .22, .084);
pulsePad(H_GM9, BAR * 112, 2, .222, .087);
pulsePad(H_BB_D, BAR * 114, 2, .224, .089);
pulsePad(H_ASUS_B9, BAR * 116, 1, .218, .086);
pulsePad(H_OPEN, BAR * 117, 1, .225, .088);
pulsePad(H_TENSION, BAR * 118, 4, .225, .093);
pulsePad(H_DM9, BAR * 122, 4, .215, .086);
chaosBeatGrid(BLACKOUT_AT, RECONNECT_AT, .94);
lowStringSequence([38,45,50,45,43,48,53,48], BLACKOUT_AT + BEAT/2, RECONNECT_AT, .029, {
  omission:step=>step%4===3,
});
midSequence([74,81,77,84,76,81,79,84], BLACKOUT_AT, BAR * 102, .014, { stepLength:BEAT/4, pan:0, omission:step=>step%16===14 });
midSequence([74,81,77,84,76,81,79,84], BAR * 118, RECONNECT_AT, .012, { stepLength:BEAT/4, pan:0, omission:step=>step%16===14 });
cyclicAccentSequence([62,69,65,72,64,69,67,72], BAR * 94, BAR * 102, .033, { period:8, accents:[0,3,6], pan:-.48 });
cyclicAccentSequence([62,69,65,72,64,69,67,72], BAR * 102, BAR * 110, .013, { period:8, accents:[0,3,6], pan:-.48 });
cyclicAccentSequence([63,70,67,74,65], BAR * 102, BAR * 110, .012, { period:5, accents:[0], pan:.48, offset:BEAT*.25 });
cyclicAccentSequence([62,69,65,72,64,69,67,72], BAR * 118, RECONNECT_AT, .026, { period:8, accents:[0,3,6], pan:-.48 });
cyclicAccentSequence([63,70,67,74,65], BAR * 118, RECONNECT_AT, .024, { period:5, accents:[0], pan:.48, offset:BEAT*.25 });
renderTheme(FLEET_THEME, BLACKOUT_AT + BEAT * .2, .058, { endBeat:32, instrument:distantThemeLead });
renderTheme(FLEET_THEME, BAR * 102, .078, { endBeat:32, instrument:signalLead });
renderTheme(FLEET_THEME, BAR * 110, .124, { startBeat:32, endBeat:64, instrument:themeLead });
renderTheme(FLEET_THEME, BAR * 119, .053, { endBeat:16, timeScale:.5, transpose:12, instrument:signalLead });
renderTheme(FLEET_THEME, BAR * 122, .049, { startBeat:16, endBeat:32, timeScale:.5, instrument:distantThemeLead });
hornAccent(H_GM9, BAR * 109 + BEAT * 3.05, BEAT * .82, .052);
hornAccent(H_TENSION, BAR * 117 + BEAT * 3.02, BEAT * .95, .06);
noiseSweep(BAR * 116, BAR * 2.5, .105);

// VII. INTERMITTENT WINDOW (4:17–4:42): the common beat reforms gradually.
pulsePad(H_BB_D, RECONNECT_AT, 6, .19, .071);
pulsePad(H_DM9, BAR * 132, 6, .18, .066);
chaosBeatGrid(RECONNECT_AT, BAR * 130, .7);
epicBeatGrid(BAR * 130, BAR * 134, .54);
beatGrid(BAR * 134, AFTERMATH_AT, .43);
cyclicAccentSequence([60,67,64,69,65,67,64,69], RECONNECT_AT, BAR * 130, .027, { period:5, accents:[0], pan:.34 });
cyclicAccentSequence([60,67,64,69,65,67,64,69], BAR * 130, BAR * 134, .025, { period:8, accents:[0,3,6], pan:.18 });
midSequence([60,67,64,69,65,67,64,69], BAR * 134, AFTERMATH_AT, .019, { stepLength:BEAT/2, pan:0 });
linkPulse(RECONNECT_AT, AFTERMATH_AT, 1, .033, true);
renderTheme(FLEET_THEME, BAR * 130, .056, { endBeat:16, instrument:themeLead });

// VIII. AFTER-ACTION PICTURE (4:42–5:00): half of the opening theme returns.
pad(H_DM9, AFTERMATH_AT, BAR * 2.1, .225, .052);
pad(H_GM9, BAR * 140, BAR * 2.1, .22, .053);
pad(H_BB_D, BAR * 142, BAR * 2.1, .218, .052);
pad(H_ASUS_B9, BAR * 144, BAR * 1.1, .214, .05);
pad(H_OPEN, BAR * 145, LENGTH - BAR * 145 + .1, .23, .048);
choirPad(H_OPEN, BAR * 145, LENGTH - BAR * 145 + .1, .034);
renderTheme(FLEET_THEME, AFTERMATH_AT + BEAT * .06, .09, { startBeat:32, endBeat:64, instrument:themeLead });
voice(62, BAR * 145.5, LENGTH - BAR * 145.5, .02, { wave:"sine", attack:1.6, release:4.2, cutoffStart:.08, cutoffEnd:.045, pan:0 });

// Cross-channel ambience is high-passed so kick and bass never accumulate in the delay return.
for (const [seconds, feedback] of [[.255,.05],[.511,.026],[.766,.011]]) {
  const delay = Math.floor(seconds * SR);
  let lowL = 0, lowR = 0;
  for (let i = delay; i < left.length; i++) {
    const sourceL = left[i - delay], sourceR = right[i - delay];
    lowL += (sourceL - lowL) * .042;
    lowR += (sourceR - lowR) * .042;
    left[i] += (sourceR - lowR) * feedback;
    right[i] += (sourceL - lowL) * feedback;
  }
}

let peak = 0;
const gateStart = BAR * 85.75, gateEnd = BAR * 86, gateFade = .08;
for (let i = 0; i < left.length; i++) {
  const time = i / SR;
  const fade = Math.min(1, time / .42, (LENGTH - time) / 5.4);
  const gate = time < gateStart - gateFade || time >= gateEnd + gateFade ? 1
    : time < gateStart ? (gateStart - time) / gateFade
      : time < gateEnd ? 0 : (time - gateEnd) / gateFade;
  left[i] *= fade * gate; right[i] *= fade * gate;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const scale = .88 / Math.max(.001, peak);
for (let i = 0; i < left.length; i++) { left[i] *= scale; right[i] *= scale; }

function wav() {
  const dataBytes = left.length * 4, buffer = Buffer.allocUnsafe(44 + dataBytes);
  buffer.write("RIFF",0); buffer.writeUInt32LE(36 + dataBytes,4); buffer.write("WAVEfmt ",8);
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(2,22);
  buffer.writeUInt32LE(SR,24); buffer.writeUInt32LE(SR * 4,28); buffer.writeUInt16LE(4,32); buffer.writeUInt16LE(16,34);
  buffer.write("data",36); buffer.writeUInt32LE(dataBytes,40);
  for (let i = 0, offset = 44; i < left.length; i++, offset += 4) {
    buffer.writeInt16LE(Math.round(clamp(left[i]) * 32767), offset);
    buffer.writeInt16LE(Math.round(clamp(right[i]) * 32767), offset + 2);
  }
  return buffer;
}

await mkdir(OUTPUT, { recursive:true });
const output = resolve(OUTPUT, "across-the-silent-band.wav");
await writeFile(output, wav());
await writeFile(resolve(OUTPUT, "theme-manifest.json"), `${JSON.stringify({
  id:"across-the-silent-band", title:"越过静默带 / Across the Silent Band",
  composerCredit:"Original score for Cold War Intercept", seconds:LENGTH, sampleRate:SR, bpm:BPM,
  file:"across-the-silent-band.mp3",
  form:[
    { at:0, title:"Fleet Under the Aurora" }, { at:BAR*16, title:"Link Order" },
    { at:BAR*40, title:"Flare Drift" }, { at:BAR*68, title:"Loss of Common Picture" },
    { at:BAR*82, title:"Carrier Fracture" }, { at:BAR*86, title:"Total Blackout" },
    { at:BAR*126, title:"Intermittent Window" }, { at:BAR*138, title:"After-action Picture" },
  ],
}, null, 2)}\n`);
console.log(`Generated ${output} (${LENGTH}s / ${BPM} BPM / ${SR}Hz)`);
