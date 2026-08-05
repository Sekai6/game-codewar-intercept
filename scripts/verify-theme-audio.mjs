import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const defaults = {
  file: "public/audio/silent-meridian/across-the-silent-band.mp3",
  expectedDuration: 300,
  durationTolerance: 0.75,
  minimumSampleRate: 44100,
  bpm: 117.5,
  quiet: [145, 175],
  climax: [177, 260],
  opening: [0, 30],
  themeWindowSeconds: 8,
  minimumRmsDeltaDb: 0.5,
  maximumRmsDeltaDb: 2.5,
  minimumRhythmRatio: 1.15,
  maximumMidrangeDominantFraction: 0.58,
  maximumMidToHighDb: 26,
  minimumOpeningThemeEvents: 5,
  minimumOpeningDistinctPitches: 4,
  minimumThemeReturnSimilarity: 0.52,
  minimumThemeReturnCount: 2,
};

function fail(message) {
  console.error(`THEME AUDIO QA FAILED: ${message}`);
  process.exit(1);
}

function parseNumber(value, option) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${option} requires a finite number; received ${value}`);
  return number;
}

function parseRange(value, option) {
  const [startText, endText, ...extra] = String(value).split(":");
  const start = Number(startText);
  const end = Number(endText);
  if (extra.length || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    fail(`${option} must use start:end seconds with end greater than start; received ${value}`);
  }
  return [start, end];
}

function printHelp() {
  console.log(`Usage: node scripts/verify-theme-audio.mjs [audio-file] [options]

Checks master metadata, blackout-climax contrast, sustained midrange occupancy,
opening-theme identity, and audible motif returns across the score.

Options:
  --file PATH                  Audio asset (default: ${defaults.file})
  --quiet START:END            Pre-climax intake in seconds (default: ${defaults.quiet.join(":")})
  --climax START:END           Panic climax in seconds (default: ${defaults.climax.join(":")})
  --opening START:END          Opening range that must establish the theme (default: ${defaults.opening.join(":")})
  --theme-window SECONDS       Motif fingerprint length (default: ${defaults.themeWindowSeconds})
  --expected-duration SECONDS  Expected duration (default: ${defaults.expectedDuration})
  --duration-tolerance SECONDS Allowed duration error (default: ${defaults.durationTolerance})
  --minimum-sample-rate HZ     Minimum sample rate (default: ${defaults.minimumSampleRate})
  --bpm NUMBER                 Pulse used for beat-correlation analysis (default: ${defaults.bpm})
  --minimum-rms-delta DB       Required climax-minus-intake RMS (default: ${defaults.minimumRmsDeltaDb})
  --maximum-rms-delta DB       Maximum lift before the climax becomes a sustained wall (default: ${defaults.maximumRmsDeltaDb})
  --minimum-rhythm-ratio N     Required climax/intake rhythm index (default: ${defaults.minimumRhythmRatio})
  --maximum-mid-dominance N    Maximum active-frame midrange dominance (default: ${defaults.maximumMidrangeDominantFraction})
  --maximum-mid-high-db DB     Maximum median mid/high contrast (default: ${defaults.maximumMidToHighDb})
  --minimum-opening-events N   Minimum pitched events in the opening motif (default: ${defaults.minimumOpeningThemeEvents})
  --minimum-opening-pitches N  Minimum distinct pitch classes in that motif (default: ${defaults.minimumOpeningDistinctPitches})
  --minimum-return-similarity N Minimum chroma similarity for a theme return (default: ${defaults.minimumThemeReturnSimilarity})
  --minimum-theme-returns N    Required non-overlapping returns, including a post-climax return (default: ${defaults.minimumThemeReturnCount})
  --json                       Print the report as JSON
  --help                       Show this help
`);
}

function parseArguments(argv) {
  const options = { ...defaults, quiet: [...defaults.quiet], climax: [...defaults.climax], opening: [...defaults.opening], json: false };
  const valueOptions = new Map([
    ["--file", ["file", String]],
    ["--quiet", ["quiet", (value) => parseRange(value, "--quiet")]],
    ["--climax", ["climax", (value) => parseRange(value, "--climax")]],
    ["--opening", ["opening", (value) => parseRange(value, "--opening")]],
    ["--theme-window", ["themeWindowSeconds", (value) => parseNumber(value, "--theme-window")]],
    ["--expected-duration", ["expectedDuration", (value) => parseNumber(value, "--expected-duration")]],
    ["--duration-tolerance", ["durationTolerance", (value) => parseNumber(value, "--duration-tolerance")]],
    ["--minimum-sample-rate", ["minimumSampleRate", (value) => parseNumber(value, "--minimum-sample-rate")]],
    ["--bpm", ["bpm", (value) => parseNumber(value, "--bpm")]],
    ["--minimum-rms-delta", ["minimumRmsDeltaDb", (value) => parseNumber(value, "--minimum-rms-delta")]],
    ["--maximum-rms-delta", ["maximumRmsDeltaDb", (value) => parseNumber(value, "--maximum-rms-delta")]],
    ["--minimum-rhythm-ratio", ["minimumRhythmRatio", (value) => parseNumber(value, "--minimum-rhythm-ratio")]],
    ["--maximum-mid-dominance", ["maximumMidrangeDominantFraction", (value) => parseNumber(value, "--maximum-mid-dominance")]],
    ["--maximum-mid-high-db", ["maximumMidToHighDb", (value) => parseNumber(value, "--maximum-mid-high-db")]],
    ["--minimum-opening-events", ["minimumOpeningThemeEvents", (value) => parseNumber(value, "--minimum-opening-events")]],
    ["--minimum-opening-pitches", ["minimumOpeningDistinctPitches", (value) => parseNumber(value, "--minimum-opening-pitches")]],
    ["--minimum-return-similarity", ["minimumThemeReturnSimilarity", (value) => parseNumber(value, "--minimum-return-similarity")]],
    ["--minimum-theme-returns", ["minimumThemeReturnCount", (value) => parseNumber(value, "--minimum-theme-returns")]],
  ]);
  let positionalFile = false;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    }
    if (argument === "--json") {
      options.json = true;
      continue;
    }

    const equalsAt = argument.indexOf("=");
    const name = equalsAt >= 0 ? argument.slice(0, equalsAt) : argument;
    if (valueOptions.has(name)) {
      const rawValue = equalsAt >= 0 ? argument.slice(equalsAt + 1) : argv[++index];
      if (rawValue === undefined) fail(`${name} requires a value`);
      const [key, parser] = valueOptions.get(name);
      options[key] = parser(rawValue);
      continue;
    }

    if (!argument.startsWith("-") && !positionalFile) {
      options.file = argument;
      positionalFile = true;
      continue;
    }
    fail(`unknown argument ${argument}`);
  }

  if (options.expectedDuration <= 0) fail("--expected-duration must be positive");
  if (options.durationTolerance < 0) fail("--duration-tolerance cannot be negative");
  if (options.minimumSampleRate <= 0) fail("--minimum-sample-rate must be positive");
  if (options.bpm <= 0) fail("--bpm must be positive");
  if (options.minimumRhythmRatio <= 0) fail("--minimum-rhythm-ratio must be positive");
  if (options.themeWindowSeconds <= 0 || options.themeWindowSeconds > options.opening[1] - options.opening[0]) fail("--theme-window must fit inside --opening");
  if (options.maximumMidrangeDominantFraction < 0 || options.maximumMidrangeDominantFraction > 1) fail("--maximum-mid-dominance must be between 0 and 1");
  if (options.minimumThemeReturnSimilarity < 0 || options.minimumThemeReturnSimilarity > 1) fail("--minimum-return-similarity must be between 0 and 1");
  if (options.minimumOpeningThemeEvents < 1 || options.minimumOpeningDistinctPitches < 1 || options.minimumThemeReturnCount < 1) fail("theme event, pitch, and return counts must be positive");
  if (options.quiet[1] > options.climax[0]) fail("--quiet must end no later than --climax begins");
  return options;
}

function run(command, args, { binary = false, maxBuffer = 128 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, {
    encoding: binary ? null : "utf8",
    maxBuffer,
    windowsHide: true,
  });
  if (result.error?.code === "ENOENT") fail(`${command} was not found; install FFmpeg and ensure it is on PATH`);
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = binary ? result.stderr?.toString("utf8") : result.stderr;
    const detail = String(stderr ?? "").trim().split(/\r?\n/).slice(-8).join("\n");
    fail(`${command} exited with ${result.status}${detail ? `\n${detail}` : ""}`);
  }
  return result;
}

function probeAudio(file) {
  const result = run("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,codec_type,sample_rate,channels,bit_rate:format=duration",
    "-of", "json",
    file,
  ]);
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    fail(`ffprobe returned invalid JSON: ${error.message}`);
  }
  const stream = data.streams?.[0];
  if (!stream || stream.codec_type !== "audio") fail("ffprobe did not find an audio stream");
  return {
    codec: stream.codec_name,
    durationSeconds: Number(data.format?.duration),
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    bitRate: Number(stream.bit_rate),
  };
}

function parseLoudness(file) {
  const result = run("ffmpeg", [
    "-hide_banner", "-nostats",
    "-i", file,
    "-map", "0:a:0",
    "-af", "ebur128=peak=true",
    "-f", "null", "-",
  ]);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const summaryAt = output.lastIndexOf("Summary:");
  if (summaryAt < 0) fail("FFmpeg ebur128 output did not contain a summary");
  const summary = output.slice(summaryAt);
  const extract = (pattern, label) => {
    const match = summary.match(pattern);
    const value = match ? Number(match[1]) : Number.NaN;
    if (!Number.isFinite(value)) fail(`FFmpeg ebur128 output did not expose a finite ${label}`);
    return value;
  };
  return {
    integratedLufs: extract(/Integrated loudness:\s*[\s\S]*?I:\s*(-?\d+(?:\.\d+)?)\s+LUFS/, "integrated loudness"),
    loudnessRangeLu: extract(/Loudness range:\s*[\s\S]*?LRA:\s*(-?\d+(?:\.\d+)?)\s+LU/, "loudness range"),
    truePeakDbfs: extract(/True peak:\s*[\s\S]*?Peak:\s*(-?\d+(?:\.\d+)?)\s+dBFS/, "true peak"),
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function movingAverage(values, radius) {
  const prefix = new Float64Array(values.length + 1);
  for (let index = 0; index < values.length; index++) prefix[index + 1] = prefix[index] + values[index];
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length, index + radius + 1);
    return (prefix[end] - prefix[start]) / (end - start);
  });
}

function correlationAt(values, lag) {
  if (lag < 1 || values.length <= lag + 2) return 0;
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = lag; index < values.length; index++) {
    const left = values[index];
    const right = values[index - lag];
    numerator += left * right;
    leftEnergy += left * left;
    rightEnergy += right * right;
  }
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function bestCorrelationNear(values, targetLag, radius = 2) {
  let best = -1;
  const center = Math.round(targetLag);
  for (let lag = Math.max(1, center - radius); lag <= center + radius; lag++) {
    best = Math.max(best, correlationAt(values, lag));
  }
  return best;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * fraction));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const mix = position - lower;
  return sorted[lower] * (1 - mix) + sorted[upper] * mix;
}

function decodeMono(file, range, sampleRate, filter) {
  const [start, end] = range;
  const args = [
    "-v", "error",
    "-ss", String(start),
    "-t", String(end - start),
    "-i", file,
    "-map", "0:a:0",
    "-vn", "-ac", "1", "-ar", String(sampleRate),
  ];
  if (filter) args.push("-af", filter);
  args.push("-c:a", "pcm_f32le", "-f", "f32le", "pipe:1");
  const result = run("ffmpeg", args, { binary: true });
  const sampleCount = Math.floor(result.stdout.length / 4);
  if (sampleCount < sampleRate) fail(`region ${start}:${end} decoded to less than one second of audio`);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index++) {
    const sample = result.stdout.readFloatLE(index * 4);
    if (!Number.isFinite(sample)) fail(`region ${start}:${end} contains a non-finite PCM sample`);
    samples[index] = sample;
  }
  return samples;
}

function biquad(type, sampleRate, frequency, q = Math.SQRT1_2) {
  const omega = 2 * Math.PI * frequency / sampleRate;
  const cosine = Math.cos(omega);
  const sine = Math.sin(omega);
  const alpha = sine / (2 * q);
  let b0;
  let b1;
  let b2;
  if (type === "lowpass") {
    b0 = (1 - cosine) / 2;
    b1 = 1 - cosine;
    b2 = b0;
  } else if (type === "highpass") {
    b0 = (1 + cosine) / 2;
    b1 = -(1 + cosine);
    b2 = b0;
  } else {
    fail(`unsupported biquad type ${type}`);
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cosine / a0;
  const a2 = (1 - alpha) / a0;
  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  let z1 = 0;
  let z2 = 0;
  return (input) => {
    const output = b0 * input + z1;
    z1 = b1 * input - a1 * output + z2;
    z2 = b2 * input - a2 * output;
    return output;
  };
}

function analyseTonalBalance(samples, sampleRate) {
  // Treat 220-2400Hz as the perceptual body of brass/pads and measure how often
  // it remains dominant instead of relying on one whole-track EQ average.
  const lowpass = biquad("lowpass", sampleRate, 220);
  const midHighpass = biquad("highpass", sampleRate, 220);
  const midLowpass = biquad("lowpass", sampleRate, 2400);
  const highpass = biquad("highpass", sampleRate, 2400);
  const frameSamples = Math.round(sampleRate * 0.25);
  const frames = [];
  let totalEnergy = 0;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let count = 0;

  const flush = () => {
    if (!count) return;
    frames.push({
      total: totalEnergy / count,
      low: lowEnergy / count,
      mid: midEnergy / count,
      high: highEnergy / count,
    });
    totalEnergy = 0;
    lowEnergy = 0;
    midEnergy = 0;
    highEnergy = 0;
    count = 0;
  };

  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    const low = lowpass(sample);
    const mid = midLowpass(midHighpass(sample));
    const high = highpass(sample);
    totalEnergy += sample * sample;
    lowEnergy += low * low;
    midEnergy += mid * mid;
    highEnergy += high * high;
    count++;
    if (count === frameSamples) flush();
  }
  flush();

  const globalTotal = frames.reduce((sum, frame) => sum + frame.total, 0) / frames.length;
  const activeThreshold = globalTotal * Math.pow(10, -18 / 10);
  const timeline = frames.map((frame) => {
    if (frame.total < activeThreshold) return null;
    const bandSum = frame.low + frame.mid + frame.high;
    return {
      midFraction: frame.mid / Math.max(bandSum, 1e-20),
      midToHighDb: 10 * Math.log10(Math.max(frame.mid, 1e-20) / Math.max(frame.high, 1e-20)),
    };
  });
  const active = frames.filter((frame) => frame.total >= activeThreshold);
  const summaries = timeline.filter(Boolean);
  const dominant = summaries.map(({ midFraction, midToHighDb }) => midFraction >= 0.52 && midToHighDb >= 12);
  let longestRun = 0;
  let run = 0;
  for (const summary of timeline) {
    const value = Boolean(summary && summary.midFraction >= 0.52 && summary.midToHighDb >= 12);
    run = value ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  const totalLow = active.reduce((sum, frame) => sum + frame.low, 0);
  const totalMid = active.reduce((sum, frame) => sum + frame.mid, 0);
  const totalHigh = active.reduce((sum, frame) => sum + frame.high, 0);

  return {
    activeFrameFraction: active.length / frames.length,
    midEnergyFraction: totalMid / Math.max(totalLow + totalMid + totalHigh, 1e-20),
    medianMidFraction: percentile(summaries.map((summary) => summary.midFraction), 0.5),
    upperQuartileMidFraction: percentile(summaries.map((summary) => summary.midFraction), 0.75),
    medianMidToHighDb: percentile(summaries.map((summary) => summary.midToHighDb), 0.5),
    dominantFrameFraction: dominant.filter(Boolean).length / Math.max(dominant.length, 1),
    longestDominantRunSeconds: longestRun * 0.25,
  };
}

function createChromaFrames(samples, inputRate) {
  // Onset chroma suppresses stationary pads; it retains pitch-class changes
  // that can form a short melodic fingerprint across octave/timbre changes.
  const melodyLowpass = biquad("lowpass", inputRate, 1800);
  const melodyHighpass = biquad("highpass", inputRate, 150);
  const analysisRate = inputRate / 2;
  const downsampled = new Float32Array(Math.floor(samples.length / 2));
  for (let input = 0, output = 0; output < downsampled.length; input += 2, output++) {
    melodyHighpass(melodyLowpass(samples[input]));
    downsampled[output] = melodyHighpass(melodyLowpass(samples[input + 1]));
  }

  const frameSeconds = 0.125;
  const frameSamples = Math.round(analysisRate * frameSeconds);
  const window = new Float64Array(frameSamples);
  for (let index = 0; index < frameSamples; index++) window[index] = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (frameSamples - 1));
  const bins = [];
  for (let midi = 52; midi <= 91; midi++) {
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    bins.push({ pitchClass: midi % 12, coefficient: 2 * Math.cos(2 * Math.PI * frequency / analysisRate) });
  }

  const raw = [];
  for (let start = 0; start + frameSamples <= downsampled.length; start += frameSamples) {
    const chroma = new Float64Array(12);
    for (const { pitchClass, coefficient } of bins) {
      let previous = 0;
      let previousPrevious = 0;
      for (let offset = 0; offset < frameSamples; offset++) {
        const current = downsampled[start + offset] * window[offset] + coefficient * previous - previousPrevious;
        previousPrevious = previous;
        previous = current;
      }
      const power = Math.max(0, previous * previous + previousPrevious * previousPrevious - coefficient * previous * previousPrevious);
      chroma[pitchClass] = Math.max(chroma[pitchClass], Math.log1p(power));
    }
    const floor = median(chroma);
    raw.push(Array.from(chroma, (value) => Math.max(0, value - floor)));
  }

  const onset = [];
  const totals = [];
  const salience = [];
  for (let frame = 0; frame < raw.length; frame++) {
    const vector = raw[frame].map((value, pitchClass) => Math.max(0, value - (raw[frame - 1]?.[pitchClass] ?? value)));
    const total = vector.reduce((sum, value) => sum + value, 0);
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    onset.push(vector.map((value) => value / Math.max(norm, 1e-12)));
    totals.push(total);
    salience.push(Math.max(...vector) / Math.max(total, 1e-12));
  }
  const totalMedian = median(totals);
  const totalMad = median(totals.map((value) => Math.abs(value - totalMedian)));
  const eventThreshold = Math.max(percentile(totals, 0.68), totalMedian + totalMad * 2.2);
  const events = totals.map((total, frame) => ({
    frame,
    timeSeconds: frame * frameSeconds,
    total,
    salience: salience[frame],
    pitchClass: onset[frame].indexOf(Math.max(...onset[frame])),
    active: total >= eventThreshold && salience[frame] >= 0.19,
  }));
  return { frameSeconds, onset, totals, salience, events, eventThreshold };
}

function sequenceSimilarity(anchor, candidate) {
  let dot = 0;
  let anchorEnergy = 0;
  let candidateEnergy = 0;
  for (let frame = 0; frame < anchor.length; frame++) {
    const sourcePosition = frame / Math.max(anchor.length - 1, 1) * Math.max(candidate.length - 1, 0);
    const sourceFrame = candidate[Math.round(sourcePosition)] ?? [];
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      const left = anchor[frame][pitchClass] ?? 0;
      const right = sourceFrame[pitchClass] ?? 0;
      dot += left * right;
      anchorEnergy += left * left;
      candidateEnergy += right * right;
    }
  }
  return dot / Math.max(Math.sqrt(anchorEnergy * candidateEnergy), 1e-12);
}

function analyseThemeShape(chroma, openingRange = [0, 30], phraseSeconds = 8) {
  const [openingStartSeconds, openingEndSeconds] = openingRange;
  const phraseFrames = Math.round(phraseSeconds / chroma.frameSeconds);
  const openingStartFrame = Math.max(0, Math.round(openingStartSeconds / chroma.frameSeconds));
  const openingFrames = Math.min(chroma.onset.length, Math.round(openingEndSeconds / chroma.frameSeconds));
  let bestOpening = null;
  for (let start = openingStartFrame; start + phraseFrames <= openingFrames; start++) {
    const events = chroma.events.slice(start, start + phraseFrames).filter((event) => event.active);
    const distinctPitches = new Set(events.map((event) => event.pitchClass)).size;
    const score = events.length + distinctPitches * 0.8 + events.reduce((sum, event) => sum + event.salience, 0) * 0.2;
    if (!bestOpening || score > bestOpening.score) {
      bestOpening = {
        startFrame: start,
        eventCount: events.length,
        distinctPitches,
        score,
        events: events.map((event) => ({
          timeSeconds: event.timeSeconds,
          pitchClass: event.pitchClass,
          salience: event.salience,
        })),
      };
    }
  }
  const anchor = chroma.onset.slice(bestOpening.startFrame, bestOpening.startFrame + phraseFrames);
  const candidates = [];
  const searchStartFrame = Math.ceil((openingEndSeconds + 2) / chroma.frameSeconds);
  const scales = [0.76, 0.86, 1, 1.16, 1.28];
  for (let start = searchStartFrame; start < chroma.onset.length - phraseFrames * 0.75; start += 2) {
    let best = 0;
    let bestScale = 1;
    for (const scale of scales) {
      const candidateFrames = Math.round(phraseFrames * scale);
      if (start + candidateFrames > chroma.onset.length) continue;
      const score = sequenceSimilarity(anchor, chroma.onset.slice(start, start + candidateFrames));
      if (score > best) {
        best = score;
        bestScale = scale;
      }
    }
    candidates.push({ timeSeconds: start * chroma.frameSeconds, similarity: best, scale: bestScale });
  }
  candidates.sort((left, right) => right.similarity - left.similarity);
  const returns = [];
  for (const candidate of candidates) {
    if (returns.every((selected) => Math.abs(selected.timeSeconds - candidate.timeSeconds) >= phraseSeconds * 0.8)) {
      returns.push(candidate);
      if (returns.length === 8) break;
    }
  }
  returns.sort((left, right) => left.timeSeconds - right.timeSeconds);
  return {
    phraseSeconds,
    openingAnchorStartSeconds: bestOpening.startFrame * chroma.frameSeconds,
    openingEventCount: bestOpening.eventCount,
    openingDistinctPitches: bestOpening.distinctPitches,
    openingScore: bestOpening.score,
    openingEvents: bestOpening.events,
    returns,
  };
}

function analyseRegion(file, range, bpm) {
  const [start, end] = range;
  const duration = end - start;
  const analysisRate = 12000;
  const result = run("ffmpeg", [
    "-v", "error",
    "-ss", String(start),
    "-t", String(duration),
    "-i", file,
    "-map", "0:a:0",
    "-vn", "-ac", "1", "-ar", String(analysisRate),
    "-af", "highpass=f=65,lowpass=f=5000",
    "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1",
  ], { binary: true });
  const pcm = result.stdout;
  const sampleCount = Math.floor(pcm.length / 4);
  if (sampleCount < analysisRate) fail(`region ${start}:${end} decoded to less than one second of audio`);

  let squareSum = 0;
  let peak = 0;
  const frameSamples = Math.round(analysisRate * 0.02);
  const frameRms = [];
  let frameSquareSum = 0;
  let frameSampleCount = 0;
  for (let index = 0; index < sampleCount; index++) {
    const sample = pcm.readFloatLE(index * 4);
    if (!Number.isFinite(sample)) fail(`region ${start}:${end} contains a non-finite PCM sample`);
    const square = sample * sample;
    squareSum += square;
    frameSquareSum += square;
    frameSampleCount++;
    peak = Math.max(peak, Math.abs(sample));
    if (frameSampleCount === frameSamples || index === sampleCount - 1) {
      frameRms.push(Math.sqrt(frameSquareSum / frameSampleCount));
      frameSquareSum = 0;
      frameSampleCount = 0;
    }
  }

  const rms = Math.sqrt(squareSum / sampleCount);
  const meanEnvelope = frameRms.reduce((sum, value) => sum + value, 0) / frameRms.length;
  const localMean = movingAverage(frameRms, 25);
  const residual = frameRms.map((value, index) => value - localMean[index]);
  const modulationDepth = Math.sqrt(residual.reduce((sum, value) => sum + value * value, 0) / residual.length) / Math.max(meanEnvelope, 1e-12);
  const positiveFlux = frameRms.slice(1).reduce((sum, value, index) => sum + Math.max(0, value - frameRms[index]), 0) / Math.max(frameRms.length - 1, 1);
  const normalizedFlux = positiveFlux / Math.max(meanEnvelope, 1e-12);
  const residualMedian = median(residual);
  const residualMad = median(residual.map((value) => Math.abs(value - residualMedian)));
  const onsetThreshold = Math.max(meanEnvelope * 0.08, residualMedian + residualMad * 2.5);
  const refractoryFrames = Math.round(0.12 / 0.02);
  let onsetCount = 0;
  let lastOnset = -refractoryFrames;
  for (let index = 1; index < residual.length - 1; index++) {
    if (
      index - lastOnset >= refractoryFrames &&
      residual[index] > onsetThreshold &&
      residual[index] >= residual[index - 1] &&
      residual[index] > residual[index + 1]
    ) {
      onsetCount++;
      lastOnset = index;
    }
  }
  const onsetRateHz = onsetCount / duration;
  const framesPerBeat = 60 / bpm / 0.02;
  const beatCorrelation = Math.max(
    bestCorrelationNear(residual, framesPerBeat),
    bestCorrelationNear(residual, framesPerBeat / 2),
  );
  // A blackout climax intentionally layers 3+3+2 and five-step cycles, so a
  // lower common-beat correlation can mean more rhythmic conflict, not less
  // activity. Weight transient rate and amplitude modulation first; retain a
  // small reward for a stable pulse without making four-square material win.
  const rhythmIndex = normalizedFlux
    * Math.sqrt(1 + onsetRateHz)
    * (1 + modulationDepth)
    * (1 + Math.max(0, beatCorrelation) * .25);

  return {
    startSeconds: start,
    endSeconds: end,
    rmsDbfs: 20 * Math.log10(Math.max(rms, 1e-12)),
    peakDbfs: 20 * Math.log10(Math.max(peak, 1e-12)),
    modulationDepth,
    normalizedFlux,
    onsetRateHz,
    beatCorrelation,
    rhythmIndex,
  };
}

function roundedReport(report) {
  return JSON.parse(JSON.stringify(report, (_, value) => typeof value === "number" ? Number(value.toFixed(4)) : value));
}

const options = parseArguments(process.argv.slice(2));
const file = resolve(options.file);
if (!existsSync(file)) fail(`audio asset does not exist: ${file}`);

const metadata = probeAudio(file);
for (const [label, range] of [["quiet", options.quiet], ["climax", options.climax], ["opening", options.opening]]) {
  if (range[1] > metadata.durationSeconds + 0.05) {
    fail(`--${label} ends at ${range[1]}s, beyond the ${metadata.durationSeconds.toFixed(3)}s asset`);
  }
}
const loudness = parseLoudness(file);
const quiet = analyseRegion(file, options.quiet, options.bpm);
const climax = analyseRegion(file, options.climax, options.bpm);
const shapeSampleRate = 8000;
const shapeSamples = decodeMono(file, [0, metadata.durationSeconds], shapeSampleRate, "highpass=f=45,lowpass=f=3800");
const tonalBalance = analyseTonalBalance(shapeSamples, shapeSampleRate);
const themeShape = analyseThemeShape(createChromaFrames(shapeSamples, shapeSampleRate), options.opening, options.themeWindowSeconds);
themeShape.openingEstablished = themeShape.openingEventCount >= options.minimumOpeningThemeEvents
  && themeShape.openingDistinctPitches >= options.minimumOpeningDistinctPitches;
themeShape.qualifiedReturns = themeShape.openingEstablished
  ? themeShape.returns.filter((candidate) => candidate.similarity >= options.minimumThemeReturnSimilarity)
  : [];
themeShape.postClimaxReturns = themeShape.qualifiedReturns.filter((candidate) => candidate.timeSeconds >= options.climax[0]);
const comparisons = {
  rmsDeltaDb: climax.rmsDbfs - quiet.rmsDbfs,
  rhythmRatio: climax.rhythmIndex / Math.max(quiet.rhythmIndex, 1e-12),
  onsetRateRatio: climax.onsetRateHz / Math.max(quiet.onsetRateHz, 1e-12),
  beatCorrelationDelta: climax.beatCorrelation - quiet.beatCorrelation,
};

const checks = [
  {
    name: "duration",
    pass: Number.isFinite(metadata.durationSeconds) && Math.abs(metadata.durationSeconds - options.expectedDuration) <= options.durationTolerance,
    detail: `${metadata.durationSeconds.toFixed(3)}s; expected ${options.expectedDuration.toFixed(3)}s ± ${options.durationTolerance.toFixed(3)}s`,
  },
  {
    name: "sample rate",
    pass: Number.isFinite(metadata.sampleRate) && metadata.sampleRate >= options.minimumSampleRate,
    detail: `${metadata.sampleRate}Hz; minimum ${options.minimumSampleRate}Hz`,
  },
  {
    name: "channels",
    pass: metadata.channels >= 2,
    detail: `${metadata.channels} channel(s); stereo master expected`,
  },
  {
    name: "loudness parse",
    pass: [loudness.integratedLufs, loudness.loudnessRangeLu, loudness.truePeakDbfs].every(Number.isFinite),
    detail: `${loudness.integratedLufs.toFixed(1)} LUFS / LRA ${loudness.loudnessRangeLu.toFixed(1)} LU / true peak ${loudness.truePeakDbfs.toFixed(1)} dBFS`,
  },
  {
    name: "true peak headroom",
    pass: loudness.truePeakDbfs <= -0.1,
    detail: `${loudness.truePeakDbfs.toFixed(1)} dBFS; must not exceed -0.1 dBFS`,
  },
  {
    name: "climax RMS floor",
    pass: comparisons.rmsDeltaDb >= options.minimumRmsDeltaDb,
    detail: `${comparisons.rmsDeltaDb.toFixed(2)} dB; minimum ${options.minimumRmsDeltaDb.toFixed(2)} dB`,
  },
  {
    name: "climax RMS ceiling",
    pass: comparisons.rmsDeltaDb <= options.maximumRmsDeltaDb,
    detail: `${comparisons.rmsDeltaDb.toFixed(2)} dB; maximum ${options.maximumRmsDeltaDb.toFixed(2)} dB`,
  },
  {
    name: "climax rhythmic lift",
    pass: comparisons.rhythmRatio >= options.minimumRhythmRatio,
    detail: `${comparisons.rhythmRatio.toFixed(2)}×; minimum ${options.minimumRhythmRatio.toFixed(2)}×`,
  },
  {
    name: "sustained midrange occupancy",
    // A dark cinematic mix may have a steep spectral slope without being a
    // sustained brass wall. Treat it as a failure only when both the temporal
    // dominance and the tonal imbalance are excessive.
    pass: tonalBalance.dominantFrameFraction <= options.maximumMidrangeDominantFraction
      || tonalBalance.medianMidToHighDb <= options.maximumMidToHighDb,
    detail: `${(tonalBalance.dominantFrameFraction * 100).toFixed(1)}% dominant frames (maximum ${(options.maximumMidrangeDominantFraction * 100).toFixed(1)}%) / median mid-high ${tonalBalance.medianMidToHighDb.toFixed(1)}dB (maximum ${options.maximumMidToHighDb.toFixed(1)}dB)`,
  },
  {
    name: "opening theme identity",
    pass: themeShape.openingEstablished,
    detail: `${themeShape.openingEventCount} pitched events / ${themeShape.openingDistinctPitches} pitch classes in best ${options.themeWindowSeconds.toFixed(1)}s phrase; minimum ${options.minimumOpeningThemeEvents} / ${options.minimumOpeningDistinctPitches}`,
  },
  {
    name: "theme recurrence",
    pass: themeShape.openingEstablished
      && themeShape.qualifiedReturns.length >= options.minimumThemeReturnCount
      && themeShape.postClimaxReturns.length >= 1,
    detail: `${themeShape.qualifiedReturns.length} clear return(s) at similarity ≥ ${options.minimumThemeReturnSimilarity.toFixed(2)}, ${themeShape.postClimaxReturns.length} after ${options.climax[0].toFixed(1)}s; minimum ${options.minimumThemeReturnCount} total and 1 post-climax`,
  },
];

const report = roundedReport({
  file,
  metadata,
  loudness,
  regions: { quiet, climax },
  tonalBalance,
  themeShape,
  comparisons,
  checks,
});

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Theme audio: ${file}`);
  console.log(`Master: ${metadata.durationSeconds.toFixed(3)}s / ${metadata.sampleRate}Hz / ${metadata.channels}ch / ${metadata.codec} / ${Number.isFinite(metadata.bitRate) ? `${Math.round(metadata.bitRate / 1000)}kbps` : "unknown bitrate"}`);
  console.log(`Loudness: ${loudness.integratedLufs.toFixed(1)} LUFS / LRA ${loudness.loudnessRangeLu.toFixed(1)} LU / true peak ${loudness.truePeakDbfs.toFixed(1)} dBFS`);
  console.log(`Intake ${options.quiet.join(":")}: RMS ${quiet.rmsDbfs.toFixed(2)} dBFS / rhythm ${quiet.rhythmIndex.toFixed(4)} / onsets ${quiet.onsetRateHz.toFixed(2)}Hz / beat corr ${quiet.beatCorrelation.toFixed(3)}`);
  console.log(`Climax ${options.climax.join(":")}: RMS ${climax.rmsDbfs.toFixed(2)} dBFS / rhythm ${climax.rhythmIndex.toFixed(4)} / onsets ${climax.onsetRateHz.toFixed(2)}Hz / beat corr ${climax.beatCorrelation.toFixed(3)}`);
  console.log(`Tonal balance: mid energy ${(tonalBalance.midEnergyFraction * 100).toFixed(1)}% / dominant frames ${(tonalBalance.dominantFrameFraction * 100).toFixed(1)}% / longest run ${tonalBalance.longestDominantRunSeconds.toFixed(1)}s / mid-high ${tonalBalance.medianMidToHighDb.toFixed(1)}dB`);
  console.log(`Opening theme: anchor ${themeShape.openingAnchorStartSeconds.toFixed(2)}s / ${themeShape.openingEventCount} events / ${themeShape.openingDistinctPitches} pitches`);
  console.log(`Theme return candidates: ${themeShape.returns.map((candidate) => `${candidate.timeSeconds.toFixed(1)}s@${candidate.similarity.toFixed(3)} scale=${candidate.scale.toFixed(2)}`).join(", ")}`);
  console.log(`Qualified returns: ${themeShape.qualifiedReturns.length} total / ${themeShape.postClimaxReturns.length} post-climax`);
  for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
}

const failures = checks.filter((check) => !check.pass);
if (failures.length) {
  console.error(`THEME AUDIO QA FAILED: ${failures.map((check) => check.name).join(", ")}`);
  process.exit(1);
}
if (!options.json) console.log("THEME AUDIO QA PASSED");
