export class ThemeTrackRuntime {
  private audio: HTMLAudioElement | null = null;
  private source = "";

  configure(source?: string) {
    if (source === this.source) return;
    this.stop();
    this.source = source ?? "";
  }

  isPlaying() { return Boolean(this.audio && !this.audio.paused); }

  async toggle() {
    if (!this.source) return false;
    if (this.audio && !this.audio.paused) { this.audio.pause(); return false; }
    this.audio ??= new Audio(this.source);
    this.audio.volume = .72;
    if (this.audio.ended) this.audio.currentTime = 0;
    await this.audio.play();
    return true;
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = "";
    this.audio = null;
  }
}
