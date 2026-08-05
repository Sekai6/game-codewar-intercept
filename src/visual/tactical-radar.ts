export type TacticalRadarClassification = "unknown" | "aircraft" | "ship" | "missile";
export type TacticalRadarSource = "organic" | "link11" | "link16" | "esm";
export type TacticalRadarOrientation = "north-up" | "heading-up";

export interface TacticalRadarTrack {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  quality: number;
  uncertaintyWorld: number;
  classification: TacticalRadarClassification;
  source: TacticalRadarSource;
  updatedAt: number;
  weaponQuality: boolean;
}

export interface TacticalRadarFriendly {
  id: string;
  x: number;
  z: number;
  headingRad: number;
}

export interface TacticalRadarFrame {
  time: number;
  ownerId: string;
  ownerLabel: string;
  sensorLabel: string;
  ownerX: number;
  ownerZ: number;
  ownerHeadingRad: number;
  networkState: string;
  tracks: TacticalRadarTrack[];
  friendlies: TacticalRadarFriendly[];
  scanBearingRad?: number;
}

export interface TacticalRadarOptions {
  canvas: HTMLCanvasElement;
  title: HTMLElement;
  status?: HTMLElement | null;
  rangeButton?: HTMLButtonElement | null;
  orientationButton?: HTMLButtonElement | null;
  onTrackSelected?: (trackId: string) => void;
}

const RANGE_STEPS_KM = [25, 50, 100, 200] as const;
const WORLD_UNITS_PER_KM = 10;

export class TacticalRadarDisplay {
  private rangeIndex = 2;
  private orientation: TacticalRadarOrientation = "north-up";
  private hits: Array<{ id: string; x: number; y: number; radius: number }> = [];

  constructor(private readonly options: TacticalRadarOptions) {
    options.rangeButton?.addEventListener("click", () => {
      this.rangeIndex = (this.rangeIndex + 1) % RANGE_STEPS_KM.length;
      this.updateControls();
    });
    options.orientationButton?.addEventListener("click", () => {
      this.orientation = this.orientation === "north-up" ? "heading-up" : "north-up";
      this.updateControls();
    });
    options.canvas.addEventListener("pointerdown", (event) => {
      const rect = options.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * options.canvas.width / rect.width;
      const y = (event.clientY - rect.top) * options.canvas.height / rect.height;
      const hit = this.hits.find((candidate) => Math.hypot(candidate.x - x, candidate.y - y) <= candidate.radius);
      if (hit) options.onTrackSelected?.(hit.id);
    });
    this.updateControls();
  }

  render(frame: TacticalRadarFrame) {
    const canvas = this.options.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.405;
    const rangeKm = RANGE_STEPS_KM[this.rangeIndex];
    const pixelsPerWorld = radius / (rangeKm * WORLD_UNITS_PER_KM);
    const rotation = this.orientation === "heading-up" ? frame.ownerHeadingRad : 0;
    const project = (x: number, z: number) => {
      const dx = x - frame.ownerX, dz = z - frame.ownerZ;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      return { x: cx + (dx * c - dz * s) * pixelsPerWorld, y: cy + (dx * s + dz * c) * pixelsPerWorld };
    };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#04151c";
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
    glow.addColorStop(0, "rgba(42,151,151,.10)");
    glow.addColorStop(1, "rgba(1,10,15,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.font = "9px Consolas, monospace";
    ctx.textBaseline = "middle";
    for (let ring = 1; ring <= 4; ring++) {
      const rr = radius * ring / 4;
      ctx.strokeStyle = ring === 4 ? "rgba(94,210,205,.72)" : "rgba(64,137,140,.42)";
      ctx.setLineDash(ring === 4 ? [] : [3, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#527f82";
      ctx.fillText(`${rangeKm * ring / 4}`, cx + 4, cy - rr + 7);
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(55,115,119,.32)";
    ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
    ctx.fillStyle = "#8bd8d3";
    ctx.fillText(this.orientation === "north-up" ? "N" : "HDG", cx - 8, cy - radius - 9);

    if (frame.scanBearingRad !== undefined) {
      const scan = frame.scanBearingRad - rotation;
      ctx.strokeStyle = "rgba(107,235,209,.62)";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(scan) * radius, cy - Math.cos(scan) * radius); ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(frame.ownerHeadingRad - rotation);
    ctx.fillStyle = "#8df1e8";
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-5, 6); ctx.lineTo(0, 3); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();

    for (const friendly of frame.friendlies) {
      const p = project(friendly.x, friendly.z);
      if (Math.hypot(p.x - cx, p.y - cy) > radius) continue;
      ctx.strokeStyle = "#64d9d5";
      ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
    }

    this.hits = [];
    let organic = 0, network = 0, stale = 0, offScope = 0;
    const classifications: Record<TacticalRadarClassification, number> = { unknown: 0, aircraft: 0, ship: 0, missile: 0 };
    const labelRects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    const ordered = [...frame.tracks].sort((a, b) => Number(a.source !== "organic") - Number(b.source !== "organic") || b.quality - a.quality);
    const plotted = new Set<string>();
    for (const track of ordered) {
      if (plotted.has(track.id)) continue;
      plotted.add(track.id);
      classifications[track.classification]++;
      track.source === "organic" ? organic++ : network++;
      const age = Math.max(0, frame.time - track.updatedAt);
      const staleThreshold = track.source === "organic" ? 7 : 18;
      const isStale = age > staleThreshold;
      if (isStale) stale++;
      const raw = project(track.x, track.z);
      const dx = raw.x - cx, dy = raw.y - cy, distancePixels = Math.hypot(dx, dy);
      const outside = distancePixels > radius;
      if (outside) offScope++;
      const scale = outside ? radius / Math.max(distancePixels, 0.001) : 1;
      const x = cx + dx * scale, y = cy + dy * scale;
      const color = track.source === "organic" ? (track.weaponQuality ? "#ff5f55" : "#ffb34e") : track.source === "link11" ? "#66a8ff" : track.source === "link16" ? "#54d4ff" : "#c17aff";
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.globalAlpha = isStale ? 0.4 : 0.94;
      ctx.setLineDash(track.source === "organic" ? [] : [4, 3]);
      const uncertainty = Math.min(25, Math.max(3, track.uncertaintyWorld * pixelsPerWorld));
      ctx.beginPath(); ctx.arc(x, y, uncertainty, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      this.drawSymbol(ctx, track.classification, x, y, track.weaponQuality);
      const vectorScale = Math.min(22, Math.hypot(track.vx, track.vz) * 5);
      if (vectorScale > 2) {
        const speed = project(track.x + track.vx * 25, track.z + track.vz * 25);
        const vdx = speed.x - raw.x, vdy = speed.y - raw.y, vl = Math.max(0.001, Math.hypot(vdx, vdy));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vdx / vl * vectorScale, y + vdy / vl * vectorScale); ctx.stroke();
      }
      const range = Math.hypot(track.x - frame.ownerX, track.z - frame.ownerZ) / WORLD_UNITS_PER_KM;
      const label = `${track.id.slice(-8).toUpperCase()} ${track.source === "organic" ? "ORG" : track.source.toUpperCase()} Q${track.quality.toFixed(2)}${outside ? ` ${range.toFixed(0)}KM` : ""}${isStale ? ` A${age.toFixed(0)}` : ""}`;
      ctx.font = "8px Consolas, monospace";
      const labelWidth = ctx.measureText(label).width;
      const labelX = Math.max(3, Math.min(w - labelWidth - 3, x + 9));
      let labelY = Math.max(8, y - 9);
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = { left: labelX - 2, top: labelY - 5, right: labelX + labelWidth + 2, bottom: labelY + 5 };
        if (!labelRects.some((rect) => candidate.left < rect.right && candidate.right > rect.left && candidate.top < rect.bottom && candidate.bottom > rect.top)) {
          labelRects.push(candidate);
          break;
        }
        labelY = Math.min(h - 7, labelY + 11);
      }
      ctx.fillText(label, labelX, labelY);
      if (outside) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx / distancePixels * 8, y - dy / distancePixels * 8); ctx.stroke(); }
      ctx.restore();
      this.hits.push({ id: track.id, x, y, radius: 10 });
    }

    this.options.title.textContent = `${frame.ownerLabel} / ${frame.sensorLabel}`;
    if (this.options.status) this.options.status.textContent = `${frame.networkState} / ORG ${organic} / NET ${network} / STALE ${stale}`;
    canvas.dataset.radarOwner = frame.ownerId;
    canvas.dataset.radarLocalTracks = String(organic);
    canvas.dataset.radarNetworkTracks = String(network);
    canvas.dataset.radarStaleTracks = String(stale);
    canvas.dataset.radarOffScopeTracks = String(offScope);
    canvas.dataset.radarAirTracks = String(classifications.aircraft);
    canvas.dataset.radarMissileTracks = String(classifications.missile);
    canvas.dataset.radarSurfaceTracks = String(classifications.ship);
    canvas.dataset.radarRangeKm = String(rangeKm);
    canvas.dataset.radarOrientation = this.orientation;
  }

  private drawSymbol(ctx: CanvasRenderingContext2D, classification: TacticalRadarClassification, x: number, y: number, weaponQuality: boolean) {
    ctx.beginPath();
    if (classification === "aircraft") { ctx.moveTo(x, y - 6); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x + 5, y + 4); ctx.closePath(); }
    else if (classification === "missile") { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); }
    else if (classification === "ship") ctx.rect(x - 6, y - 4, 12, 8);
    else { ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); }
    weaponQuality ? ctx.fill() : ctx.stroke();
  }

  private updateControls() {
    if (this.options.rangeButton) this.options.rangeButton.textContent = `RNG ${RANGE_STEPS_KM[this.rangeIndex]} KM`;
    if (this.options.orientationButton) this.options.orientationButton.textContent = this.orientation === "north-up" ? "NORTH UP" : "HEADING UP";
  }
}
