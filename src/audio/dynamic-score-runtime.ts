import type { SpaceWeatherPhase } from "../space-weather/types";

type LayerId = "polar-bed" | "link-pulse" | "contact-tension" | "missile-engagement" | "total-blackout" | "recovery";

export interface DynamicScoreState {
  phase: SpaceWeatherPhase | "none";
  contactConfirmed: boolean;
  combatIntensity: number;
  communicationWindowOpen: boolean;
  paused: boolean;
}

const LAYERS: readonly LayerId[] = ["polar-bed", "link-pulse", "contact-tension", "missile-engagement", "total-blackout", "recovery"];
const STORAGE_ENABLED = "cwi.dynamic-score-enabled";
const STORAGE_VOLUME = "cwi.dynamic-score-volume";

export class DynamicScoreRuntime {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private gains = new Map<LayerId, GainNode>();
  private sources = new Map<LayerId, AudioBufferSourceNode>();
  private loading: Promise<void> | null = null;
  private soundtrackId: string | null = null;
  private requestedEnabled = false;
  private previewMuted = false;
  private volume = .72;

  constructor() {
    try {
      const storedEnabled = localStorage.getItem(STORAGE_ENABLED);
      // The scenario advertises an authored dynamic score, so first-time
      // players should hear it without discovering a hidden opt-in. Preserve
      // an explicit OFF choice on later visits.
      this.requestedEnabled = storedEnabled === null ? true : storedEnabled === "true";
      const storedVolumeText = localStorage.getItem(STORAGE_VOLUME);
      if (storedVolumeText !== null) {
        const storedVolume = Number(storedVolumeText);
        if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1) this.volume = storedVolume;
      }
    } catch { /* local storage may be unavailable */ }
  }

  configure(soundtrackId?: string) {
    const next = soundtrackId === "silent-meridian" ? soundtrackId : null;
    if (next === this.soundtrackId) return;
    this.stopLayers();
    this.soundtrackId = next;
    this.loading = null;
  }

  isAvailable() { return this.soundtrackId === "silent-meridian"; }
  isEnabled() { return this.requestedEnabled && this.isAvailable(); }

  async setEnabled(enabled: boolean) {
    this.requestedEnabled = enabled;
    try { localStorage.setItem(STORAGE_ENABLED, String(enabled)); } catch { /* ignore */ }
    if (!enabled) {
      this.fadeMaster(0);
      return;
    }
    if (!this.isAvailable()) return;
    await this.ensureStarted();
    this.fadeMaster(this.previewMuted ? 0 : this.volume);
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    try { localStorage.setItem(STORAGE_VOLUME, String(this.volume)); } catch { /* ignore */ }
    if (this.isEnabled()) this.fadeMaster(this.previewMuted ? 0 : this.volume);
  }

  setPreviewMuted(muted: boolean) {
    this.previewMuted = muted;
    if (this.isEnabled()) this.fadeMaster(muted ? 0 : this.volume);
  }

  async resumeFromGesture() {
    if (!this.isEnabled()) return;
    await this.ensureStarted();
    await this.context?.resume();
    this.fadeMaster(this.previewMuted ? 0 : this.volume);
  }

  update(state: DynamicScoreState) {
    if (!this.context || !this.master || !this.sources.size) return;
    const combat = Math.max(0, Math.min(1, state.combatIntensity));
    const phase = state.phase;
    const blackout = phase === "total-blackout" ? .4 : phase === "degrading" || phase === "solar-flare" ? .14 : 0;
    const recovery = phase === "recovery" ? .48 : phase === "intermittent" ? (state.communicationWindowOpen ? .42 : .2) : 0;
    const link = phase === "quiet" ? .3 : phase === "warning" ? .24 : phase === "solar-flare" ? .14 : phase === "degrading" ? .08 : phase === "intermittent" && state.communicationWindowOpen ? .16 : phase === "recovery" ? .2 : 0;
    this.target("polar-bed", state.paused ? .07 : .24, 1.8);
    this.target("link-pulse", state.paused ? 0 : link, .9);
    this.target("contact-tension", state.paused ? 0 : state.contactConfirmed ? .3 * (1 - combat * .35) : 0, 1.4);
    this.target("missile-engagement", state.paused ? 0 : combat * .58, .35);
    this.target("total-blackout", state.paused ? .04 : blackout, 2.2);
    this.target("recovery", state.paused ? 0 : recovery, 2.4);
  }

  accent(side: "blue" | "red") {
    if (!this.context || !this.isEnabled()) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = side === "blue" ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(side === "blue" ? 92 : 72, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(side === "blue" ? 46 : 36, this.context.currentTime + .42);
    gain.gain.setValueAtTime(.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.13, this.context.currentTime + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + .55);
    oscillator.connect(gain).connect(this.master!);
    oscillator.start(); oscillator.stop(this.context.currentTime + .58);
  }

  dispose() {
    this.stopLayers();
    void this.context?.close();
    this.context = null; this.master = null;
  }

  private async ensureStarted() {
    if (!this.soundtrackId || this.sources.size) return;
    if (this.loading) return this.loading;
    this.loading = this.startLayers();
    try { await this.loading; } finally { this.loading = null; }
  }

  private async startLayers() {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.master = this.context.createGain();
    this.master.gain.value = .0001;
    this.master.connect(this.context.destination);
    const buffers = await Promise.all(LAYERS.map(async layer => {
      const response = await fetch(`/audio/${this.soundtrackId}/${layer}.wav`);
      if (!response.ok) throw new Error(`Dynamic score layer failed: ${layer} (${response.status})`);
      return [layer, await this.context!.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    const startAt = this.context.currentTime + .08;
    for (const [layer, buffer] of buffers) {
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer; source.loop = true; gain.gain.value = 0;
      source.connect(gain).connect(this.master); source.start(startAt);
      this.sources.set(layer, source); this.gains.set(layer, gain);
    }
  }

  private target(layer: LayerId, value: number, seconds: number) {
    const gain = this.gains.get(layer); if (!gain || !this.context) return;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setTargetAtTime(Math.max(0, value), this.context.currentTime, Math.max(.02, seconds / 3));
  }

  private fadeMaster(value: number) {
    if (!this.master || !this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(Math.max(.0001, value), this.context.currentTime, .22);
  }

  private stopLayers() {
    for (const source of this.sources.values()) { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); }
    for (const gain of this.gains.values()) gain.disconnect();
    this.sources.clear(); this.gains.clear();
    this.master?.disconnect(); this.master = null;
  }
}
