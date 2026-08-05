import type { GuidanceFocus, ScenarioDocument, ScenarioForceDefinition, ScenarioVec3 } from "../scenario-system/types";
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
  onRegenerateScenario?: (seed: number) => void;
  scoreEnabled?: boolean;
  onScoreToggle?: (enabled: boolean) => void;
  themePlaying?: boolean;
  onThemeToggle?: () => Promise<boolean> | boolean;
}

export class ScenarioGuidanceUi {
  readonly root: HTMLDivElement;
  private briefing: HTMLDivElement;
  private cue: HTMLDivElement;
  private hud: HTMLDivElement;
  private hudPhase: HTMLElement;
  private hudTask: HTMLElement;
  private hudContact: HTMLElement;
  private hudMode: HTMLSelectElement;
  private mode: ScenarioGuidanceMode;
  private briefingOpen = true;
  private dossierOpen = false;
  private scoreEnabled: boolean;
  private themePlaying: boolean;
  private renderedCueKey = "";
  private activeFocus: GuidanceFocus | undefined;

  constructor(readonly scenario: ScenarioDocument, private options: ScenarioGuidanceUiOptions = {}) {
    this.mode = ScenarioGuidanceUi.loadMode();
    this.scoreEnabled = Boolean(options.scoreEnabled);
    this.themePlaying = Boolean(options.themePlaying);
    this.root = document.createElement("div");
    this.root.className = "scenario-guidance-root";
    const runtimeScore = scenario.guidance.soundtrack ? `<label class="runtime-score">SCORE <button type="button" data-runtime-score aria-pressed="${this.scoreEnabled}">${this.scoreEnabled ? "ON" : "OFF"}</button></label>` : "";
    this.root.innerHTML = `<section class="scenario-briefing" role="dialog" aria-modal="true"></section><aside class="scenario-cue" aria-live="polite"></aside><aside class="scenario-phase-hud"><b data-phase></b><span data-task></span><small data-contact></small><label>GUIDANCE <select data-runtime-mode>${MODES.map((mode) => `<option value="${mode}">${modeLabel(mode)}</option>`).join("")}</select></label>${runtimeScore}</aside>`;
    this.briefing = this.root.querySelector(".scenario-briefing")!;
    this.cue = this.root.querySelector(".scenario-cue")!;
    this.hud = this.root.querySelector(".scenario-phase-hud")!;
    this.hudPhase = this.hud.querySelector("[data-phase]")!;
    this.hudTask = this.hud.querySelector("[data-task]")!;
    this.hudContact = this.hud.querySelector("[data-contact]")!;
    this.hudMode = this.hud.querySelector("[data-runtime-mode]")!;
    this.hudMode.value = this.mode;
    this.hudMode.addEventListener("change", () => this.setMode(this.hudMode.value as ScenarioGuidanceMode));
    this.hud.querySelector<HTMLElement>("[data-runtime-score]")?.addEventListener("click", () => this.toggleScore());
    this.cue.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-focus]") && this.activeFocus) this.options.onFocus?.(this.activeFocus);
      if (target.closest("[data-dismiss]")) {
        this.cue.classList.remove("visible");
        this.renderedCueKey = "";
        this.options.onDismissCue?.();
      }
    });
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
    this.hudMode.value = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* storage can be unavailable */ }
    this.options.onModeChange?.(mode);
    this.renderBriefing();
    if (mode === "off") this.cue.classList.remove("visible");
  }

  update(snapshot: ScenarioGuidanceSnapshot, phaseLabel: string, platformTask = "OBSERVE JOINT OPERATIONS") {
    const window = this.scenario.guidance.estimatedContactWindow;
    const contact = window
      ? snapshot.scenarioTime < window[0] ? `CONTACT ${formatTime(window[0])}-${formatTime(window[1])}`
        : snapshot.scenarioTime <= window[1] ? "CONTACT WINDOW OPEN" : "CONTACT WINDOW PASSED"
      : "CONTACT WINDOW UNAVAILABLE";
    this.hudPhase.textContent = phaseLabel;
    this.hudTask.textContent = `T+${formatTime(snapshot.scenarioTime)} / ${platformTask}`;
    this.hudContact.textContent = `${contact}${snapshot.paused ? " / PAUSED" : ""}`;
    const active = snapshot.activeCue;
    if (!active || snapshot.mode === "off") {
      this.cue.classList.remove("visible");
      this.renderedCueKey = "";
      this.activeFocus = undefined;
      return;
    }
    const focus = active.cue.focus;
    const cueKey = `${active.cue.id}:${active.activatedAt}:${snapshot.mode}`;
    this.cue.className = `scenario-cue visible ${active.cue.category}`;
    this.activeFocus = focus;
    if (cueKey === this.renderedCueKey) return;
    this.renderedCueKey = cueKey;
    this.cue.innerHTML = `<header><span>${active.cue.category.toUpperCase()}</span><button type="button" data-dismiss aria-label="Dismiss">×</button></header><b>${this.escape(active.cue.title)}</b><p>${this.escape(active.cue.message)}</p>${focus ? `<button type="button" data-focus>${this.escape(focus.label)}</button>` : ""}`;
  }

  closeBriefing() {
    if (!this.briefingOpen) return;
    this.briefingOpen = false;
    this.briefing.classList.add("closed");
    this.options.onModalLockChange?.(false);
    this.options.onBriefingClosed?.();
  }

  private setDossierOpen(open: boolean) {
    this.dossierOpen = open;
    this.briefing.querySelector(".scenario-dossier")?.classList.toggle("open", open);
    this.briefing.querySelector<HTMLElement>("[data-dossier-open]")?.setAttribute("aria-expanded", String(open));
    if (open) this.briefing.querySelector<HTMLElement>(".scenario-dossier [data-dossier-close]")?.focus();
    else this.briefing.querySelector<HTMLElement>("[data-dossier-open]")?.focus();
  }

  private toggleScore() {
    this.scoreEnabled = !this.scoreEnabled;
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-score-toggle]")) {
      button.classList.toggle("enabled", this.scoreEnabled);
      button.setAttribute("aria-pressed", String(this.scoreEnabled));
      button.childNodes[0].textContent = this.scoreEnabled ? "SCORE ON" : "ENABLE SCORE";
    }
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-runtime-score]")) {
      button.setAttribute("aria-pressed", String(this.scoreEnabled));
      button.textContent = this.scoreEnabled ? "ON" : "OFF";
    }
    this.options.onScoreToggle?.(this.scoreEnabled);
  }

  private async toggleTheme() {
    this.themePlaying = await this.options.onThemeToggle?.() ?? false;
    const button = this.briefing.querySelector<HTMLElement>("[data-theme-toggle]");
    if (!button) return;
    button.classList.toggle("playing", this.themePlaying);
    button.setAttribute("aria-pressed", String(this.themePlaying));
    const label = button.querySelector("b");
    if (label) label.textContent = this.themePlaying ? "PAUSE THEME" : "PLAY THEME";
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
    const dossierButton = briefing.dossier ? `<button type="button" data-dossier-open aria-expanded="${this.dossierOpen}">READ INTELLIGENCE DOSSIER</button>` : "";
    const scoreButton = this.scenario.guidance.soundtrack ? `<button type="button" data-score-toggle class="${this.scoreEnabled ? "enabled" : ""}" aria-pressed="${this.scoreEnabled}">${this.scoreEnabled ? "SCORE ON" : "ENABLE SCORE"}<small>${this.escape(this.scenario.guidance.soundtrack.title)}</small></button>` : "";
    const theme = this.scenario.guidance.soundtrack?.theme;
    const themeButton = theme ? `<button type="button" data-theme-toggle class="${this.themePlaying ? "playing" : ""}" aria-pressed="${this.themePlaying}"><b>${this.themePlaying ? "PAUSE THEME" : "PLAY THEME"}</b><small>${this.escape(theme.title)} / ${formatTime(theme.durationSeconds)}</small></button>` : "";
    this.briefing.innerHTML = `<header><div><small>${this.escape(this.scenario.metadata.region)} / ${this.scenario.metadata.year}</small><h2>${this.escape(this.scenario.metadata.title)}</h2><p>${this.escape(this.scenario.metadata.subtitle ?? this.scenario.metadata.description)}</p></div><span class="scenario-source ${this.scenario.metadata.builtIn ? "built-in" : "imported"}">${sourceBadge}</span></header><div class="scenario-briefing-layout"><main>${this.renderTheaterMap()}<div class="scenario-briefing-grid">${section("STRATEGIC BACKGROUND", briefing.strategicBackground)}${section("SCENARIO FEATURES", briefing.features)}${section("CONTROLS", briefing.controls)}</div></main><aside>${this.renderMissionCards()}${this.renderForceEstimate()}${this.renderTimeline()}${section("INTELLIGENCE NOTES", briefing.intelligenceEstimate)}</aside></div><footer><div class="scenario-seed"><small>SCENARIO SEED</small><b>${this.scenario.simulation.seed}</b><span>DETERMINISTIC / REPLAYABLE</span></div>${dossierButton}${themeButton}${scoreButton}<button type="button" data-regenerate>GENERATE NEW SITUATION</button><label>GUIDANCE <select data-mode>${MODES.map((mode) => `<option value="${mode}"${mode === this.mode ? " selected" : ""}>${modeLabel(mode)}</option>`).join("")}</select></label><button type="button" data-begin>BEGIN OBSERVATION</button></footer>${this.renderDossier()}`;
    this.briefing.querySelector<HTMLSelectElement>("[data-mode]")?.addEventListener("change", (event) => this.setMode((event.currentTarget as HTMLSelectElement).value as ScenarioGuidanceMode));
    this.briefing.querySelector<HTMLElement>("[data-begin]")?.addEventListener("click", () => this.closeBriefing());
    this.briefing.querySelector<HTMLElement>("[data-dossier-open]")?.addEventListener("click", () => this.setDossierOpen(true));
    this.briefing.querySelector<HTMLElement>("[data-dossier-close]")?.addEventListener("click", () => this.setDossierOpen(false));
    this.briefing.querySelector<HTMLElement>("[data-score-toggle]")?.addEventListener("click", () => this.toggleScore());
    this.briefing.querySelector<HTMLElement>("[data-theme-toggle]")?.addEventListener("click", () => void this.toggleTheme());
    this.briefing.querySelector<HTMLElement>(".scenario-dossier")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) this.setDossierOpen(false);
    });
    this.briefing.querySelector<HTMLElement>("[data-regenerate]")?.addEventListener("click", () => {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      this.options.onRegenerateScenario?.(values[0] || this.scenario.simulation.seed + 1);
    });
    if (!this.briefingOpen) this.briefing.classList.add("closed");
  }

  private renderDossier() {
    const dossier = this.scenario.guidance.briefing.dossier;
    if (!dossier) return "";
    const sections = dossier.sections.map((section, index) => `<section><header><span>${String(index + 1).padStart(2, "0")}</span><div>${section.kicker ? `<small>${this.escape(section.kicker)}</small>` : ""}<h3>${this.escape(section.heading)}</h3></div></header>${section.paragraphs.map((paragraph) => `<p>${this.escape(paragraph)}</p>`).join("")}</section>`).join("");
    return `<article class="scenario-dossier${this.dossierOpen ? " open" : ""}" role="dialog" aria-modal="true" aria-label="${this.escape(dossier.title)}"><div class="dossier-paper"><header><div><small>${this.escape(dossier.classification)}</small><h2>${this.escape(dossier.title)}</h2><time>${this.escape(dossier.dateline)}</time></div><button type="button" data-dossier-close aria-label="Close intelligence dossier">CLOSE DOSSIER</button></header><blockquote>${this.escape(dossier.lead)}</blockquote><div class="dossier-sections">${sections}</div><footer><span>OPERATION SILENT MERIDIAN</span><b>THE PICTURE IS NEVER COMPLETE</b><span>FILE 88-NOR-23</span></footer></div></article>`;
  }

  private renderMissionCards() {
    const objectives = this.scenario.objectives.filter((objective) => objective.side === "blue");
    return `<section class="briefing-missions"><h3>MISSION PRIORITIES</h3>${objectives.map((objective, index) => `<article class="${objective.optional ? "optional" : "primary"}"><small>${objective.optional ? "SECONDARY" : index < 2 ? "PRIMARY" : "OBSERVATION"}</small><b>${this.escape(objective.title)}</b><p>${this.escape(objective.description)}</p></article>`).join("")}</section>`;
  }

  private renderForceEstimate() {
    const blue = this.scenario.forces.filter((force) => force.side === "blue");
    const ships = blue.filter((force) => force.kind === "ship").length;
    const aircraft = blue.reduce((sum, force) => sum + (force.kind === "air-formation" ? force.count : 0), 0);
    const bombers = this.scenario.forces.reduce((sum, force) => sum + (force.side === "red" && force.kind === "air-formation" && force.mission === "anti-ship" ? force.count : 0), 0);
    const low = Math.max(2, Math.floor(bombers / 2) * 2), high = Math.max(low + 2, Math.ceil(bombers / 2) * 2 + 2);
    return `<section class="briefing-forces"><h3>ORDER OF BATTLE</h3><div><span>BLUE CONFIRMED<b>${ships} SURFACE / ${aircraft} AIRCRAFT</b></span><span>RED ESTIMATE<b>BADGER GROUP ${low}-${high}</b><small>FIGHTER ESCORT PROBABLE / AEW POSSIBLE</small></span></div></section>`;
  }

  private renderTimeline() {
    const phases = this.scenario.timeline.filter((event) => event.type === "space-weather-phase");
    const labels: Record<string, string> = { quiet:"NORMAL COMMS", warning:"PROPAGATION WARNING", "solar-flare":"SOLAR FLARE", degrading:"NETWORK DEGRADING", "total-blackout":"TOTAL BAND DENIAL", intermittent:"INTERMITTENT WINDOWS", recovery:"RECOVERY" };
    return `<section class="briefing-timeline"><h3>SPACE WEATHER FORECAST</h3><div>${phases.map((event) => `<span><time>T+${formatTime(event.at)}</time><i></i><b>${labels[event.value] ?? this.escape(event.value.toUpperCase())}</b></span>`).join("")}</div><small>FORECAST TIMING / LOCAL PICTURES MAY DEGRADE DIFFERENTLY</small></section>`;
  }

  private renderTheaterMap() {
    const friendly = this.scenario.forces.filter((force) => force.side === "blue");
    const friendlyRouteIds = new Set(friendly.map((force) => force.routeId).filter((id): id is string => Boolean(id)));
    const routes = this.scenario.routes.filter((route) => friendlyRouteIds.has(route.id));
    const zones = this.scenario.zones.filter((zone) => zone.visibleInBriefing);
    const points: ScenarioVec3[] = [...friendly.map((force) => force.position), ...routes.flatMap((route) => route.points.map((point) => point.position)), ...zones.map((zone) => zone.center)];
    if (!points.length) return "";
    const xs = points.map((point) => point[0]), zs = points.map((point) => point[2]), margin = 180;
    const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin, minZ = Math.min(...zs) - margin, maxZ = Math.max(...zs) + margin;
    const width = 820, height = 360, pad = 28;
    const scale = Math.min((width - pad * 2) / Math.max(1, maxX - minX), (height - pad * 2) / Math.max(1, maxZ - minZ));
    const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxZ - minZ) * scale) / 2;
    const project = (position: ScenarioVec3) => [offsetX + (position[0] - minX) * scale, height - offsetY - (position[2] - minZ) * scale] as const;
    const routeSvg = routes.map((route) => `<polyline class="route ${route.kind}" points="${route.points.map((point) => project(point.position).join(",")).join(" ")}"/>`).join("");
    const zoneSvg = zones.map((zone) => {
      const [x, y] = project(zone.center), radius = Math.max(7, zone.radius * scale);
      if (zone.kind === "threat-estimate") return `<g class="zone threat-estimate"><circle class="estimate-outer" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}"/><circle class="estimate-core" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius * .52).toFixed(1)}"/><path class="threat-axis" d="M ${(x + radius * .55).toFixed(1)} ${(y + radius * .5).toFixed(1)} L ${(x - radius * .55).toFixed(1)} ${(y - radius * .5).toFixed(1)}"/><text x="${(x + radius + 4).toFixed(1)}" y="${y.toFixed(1)}">POSSIBLE RED AIR ACTIVITY</text><text class="confidence" x="${(x + radius + 4).toFixed(1)}" y="${(y + 11).toFixed(1)}">CONFIDENCE MODERATE / ±${Math.round(zone.radius / this.scenario.simulation.worldUnitsPerKm)} KM</text></g>`;
      return `<g class="zone ${zone.kind}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}"/><text x="${(x + radius + 4).toFixed(1)}" y="${y.toFixed(1)}">${this.escape(zone.id.replaceAll("-", " ").toUpperCase())}</text></g>`;
    }).join("");
    const forceSvg = friendly.map((force: ScenarioForceDefinition, index) => {
      const [x, y] = project(force.position), radians = force.headingDeg * Math.PI / 180;
      const hx = x + Math.sin(radians) * 18, hy = y - Math.cos(radians) * 18;
      const symbol = force.kind === "ship" ? "◆" : force.mission === "aew" ? "◉" : "▲";
      return `<g class="friendly"><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"/><text class="symbol" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${symbol}</text><text x="${(x + 11).toFixed(1)}" y="${(y + (index % 2 ? 14 : -9)).toFixed(1)}">${this.escape(force.id.toUpperCase())}</text></g>`;
    }).join("");
    const scaleKm = Math.max(10, Math.round(76 / scale / this.scenario.simulation.worldUnitsPerKm / 10) * 10);
    return `<section class="scenario-theater-map"><header><div><b>PRE-MISSION THEATER PICTURE</b><small>FRIENDLY POSITIONS / PLANNED ROUTES / ESTIMATED THREAT AREAS</small></div><span>TRUE NORTH ↑</span></header><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Pre-mission theater map"><defs><pattern id="scenario-grid" width="41" height="36" patternUnits="userSpaceOnUse"><path d="M 41 0 L 0 0 0 36"/></pattern><radialGradient id="threat-probability"><stop offset="0" stop-color="#b85344" stop-opacity=".32"/><stop offset=".55" stop-color="#a34e43" stop-opacity=".14"/><stop offset="1" stop-color="#8b413a" stop-opacity=".02"/></radialGradient><marker id="threat-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#b66657"/></marker></defs><rect width="${width}" height="${height}" class="map-background"/><rect width="${width}" height="${height}" fill="url(#scenario-grid)"/>${zoneSvg}${routeSvg}${forceSvg}<g class="map-scale"><path d="M 34 ${height - 24} h 76"/><text x="34" y="${height - 30}">${scaleKm} KM</text></g></svg><footer><span><i class="blue"></i> FRIENDLY TRUE POSITION</span><span><i class="route-key"></i> PLANNED ROUTE</span><span><i class="estimate"></i> ESTIMATED ACTIVITY / NOT LIVE TRUTH</span><span>INTEL AGE 46 MIN / CONFIDENCE MODERATE</span></footer></section>`;
  }

  private escape(value: string) {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  }
}
