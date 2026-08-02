import type { GuidanceFocus, ScenarioDocument } from "../scenario-system/types";
import type { ScenarioGuidanceMode, ScenarioGuidanceSnapshot } from "../scenario-system/guidance-runtime";

const STORAGE_KEY = "cwi.scenario-guidance-mode";
const MODES: readonly ScenarioGuidanceMode[] = ["full", "critical", "off"];
const modeLabel = (mode: ScenarioGuidanceMode) => ({ full: "FULL GUIDANCE", critical: "KEY EVENTS", off: "OFF" })[mode];
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export interface ScenarioGuidanceUiOptions {
  parent?: HTMLElement;
  onModeChange?: (mode: ScenarioGuidanceMode) => void;
  onFocus?: (focus: GuidanceFocus) => void;
  onDismissCue?: () => void;
  onBriefingClosed?: () => void;
  onModalLockChange?: (locked: boolean) => void;
}

export class ScenarioGuidanceUi {
  readonly root: HTMLDivElement;
  private briefing: HTMLDivElement;
  private cue: HTMLDivElement;
  private hud: HTMLDivElement;
  private mode: ScenarioGuidanceMode;
  private briefingOpen = true;

  constructor(readonly scenario: ScenarioDocument, private options: ScenarioGuidanceUiOptions = {}) {
    this.mode = ScenarioGuidanceUi.loadMode();
    this.root = document.createElement("div");
    this.root.className = "scenario-guidance-root";
    this.root.innerHTML = `<section class="scenario-briefing" role="dialog" aria-modal="true"></section><aside class="scenario-cue" aria-live="polite"></aside><aside class="scenario-phase-hud"></aside>`;
    this.briefing = this.root.querySelector(".scenario-briefing")!;
    this.cue = this.root.querySelector(".scenario-cue")!;
    this.hud = this.root.querySelector(".scenario-phase-hud")!;
    (options.parent ?? document.body).append(this.root);
    this.renderBriefing();
    this.options.onModalLockChange?.(true);
  }

  static loadMode(): ScenarioGuidanceMode {
    try {
      const value = localStorage.getItem(STORAGE_KEY) as ScenarioGuidanceMode | null;
      return value && MODES.includes(value) ? value : "full";
    } catch { return "full"; }
  }

  getMode() { return this.mode; }

  setMode(mode: ScenarioGuidanceMode) {
    this.mode = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* storage can be unavailable */ }
    this.options.onModeChange?.(mode);
    this.renderBriefing();
    if (mode === "off") this.cue.classList.remove("visible");
  }

  update(snapshot: ScenarioGuidanceSnapshot, phaseLabel: string, platformTask = "OBSERVE JOINT OPERATIONS") {
    const window = this.scenario.guidance.estimatedContactWindow;
    const contact = window
      ? snapshot.scenarioTime < window[0] ? `CONTACT ${formatTime(window[0])}–${formatTime(window[1])}`
        : snapshot.scenarioTime <= window[1] ? "CONTACT WINDOW OPEN" : "CONTACT WINDOW PASSED"
      : "CONTACT WINDOW UNAVAILABLE";
    this.hud.innerHTML = `<b>${this.escape(phaseLabel)}</b><span>T+${formatTime(snapshot.scenarioTime)} · ${this.escape(platformTask)}</span><small>${contact}${snapshot.paused ? " · PAUSED" : ""}</small>`;
    const active = snapshot.activeCue;
    if (!active || snapshot.mode === "off") { this.cue.classList.remove("visible"); return; }
    const focus = active.cue.focus;
    this.cue.className = `scenario-cue visible ${active.cue.category}`;
    this.cue.innerHTML = `<header><span>${active.cue.category.toUpperCase()}</span><button type="button" data-dismiss aria-label="Dismiss">×</button></header><b>${this.escape(active.cue.title)}</b><p>${this.escape(active.cue.message)}</p>${focus ? `<button type="button" data-focus>${this.escape(focus.label)}</button>` : ""}`;
    this.cue.querySelector<HTMLElement>("[data-focus]")?.addEventListener("click", () => this.options.onFocus?.(focus!));
    this.cue.querySelector<HTMLElement>("[data-dismiss]")?.addEventListener("click", () => {
      this.cue.classList.remove("visible");
      this.options.onDismissCue?.();
    });
  }

  closeBriefing() {
    if (!this.briefingOpen) return;
    this.briefingOpen = false;
    this.briefing.classList.add("closed");
    this.options.onModalLockChange?.(false);
    this.options.onBriefingClosed?.();
  }

  destroy() {
    if (this.briefingOpen) this.options.onModalLockChange?.(false);
    this.briefingOpen = false;
    this.root.remove();
  }

  private renderBriefing() {
    const briefing = this.scenario.guidance.briefing;
    const section = (title: string, values: readonly string[]) => `<section><h3>${title}</h3><ul>${values.map((value) => `<li>${this.escape(value)}</li>`).join("")}</ul></section>`;
    const sourceBadge = this.scenario.metadata.builtIn ? "BUILT-IN SCENARIO" : "IMPORTED SCENARIO / LOCAL DATA";
    this.briefing.innerHTML = `<header><small>${this.escape(this.scenario.metadata.region)} · ${this.scenario.metadata.year}</small><h2>${this.escape(this.scenario.metadata.title)}</h2><p>${this.escape(this.scenario.metadata.subtitle ?? this.scenario.metadata.description)}</p></header><div class="scenario-briefing-grid">${section("STRATEGIC BACKGROUND", briefing.strategicBackground)}${section("BLUE FORCE MISSION", briefing.blueMission)}${section("INTELLIGENCE ESTIMATE", briefing.intelligenceEstimate)}${section("SCENARIO FEATURES", briefing.features)}${section("CONTROLS", briefing.controls)}</div><footer><label>GUIDANCE <select data-mode>${MODES.map((mode) => `<option value="${mode}"${mode === this.mode ? " selected" : ""}>${modeLabel(mode)}</option>`).join("")}</select></label><button type="button" data-begin>BEGIN OBSERVATION</button></footer>`;
    this.briefing.querySelector<HTMLSelectElement>("[data-mode]")?.addEventListener("change", (event) => this.setMode((event.currentTarget as HTMLSelectElement).value as ScenarioGuidanceMode));
    this.briefing.querySelector<HTMLElement>("[data-begin]")?.addEventListener("click", () => this.closeBriefing());
    const header = this.briefing.querySelector("header");
    header?.insertAdjacentHTML("beforeend", `<span class="scenario-source ${this.scenario.metadata.builtIn ? "built-in" : "imported"}">${sourceBadge}</span>`);
    if (!this.briefingOpen) this.briefing.classList.add("closed");
  }

  private escape(value: string) {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  }
}
