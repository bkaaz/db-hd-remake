import { state, emitChange, selectedStep, type Box, type FrameDef } from "./store";
import { getSource } from "./imageProcess";

export const BOX_COLORS: Record<string, string> = {
  hit: "#ff3b3b",
  hurt: "#4be04b",
  push: "#4b9bff",
};

/**
 * Canvas for editing the collision boxes of the currently selected animation
 * step. Shows that step's frame with its anchor centered; drag to add a box of
 * the current type, click a box to select it. Coordinates are stored in px
 * relative to the frame's anchor (docs/data-format.md), Y-down.
 */
export class BoxEditor {
  private ctx: CanvasRenderingContext2D;
  private readonly scale = 2;
  private readonly cx: number;
  private readonly cy: number;
  private dragStart: { x: number; y: number } | null = null;
  private dragBox: Box | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.cx = Math.round(canvas.width / 2);
    this.cy = Math.round(canvas.height * 0.72);
    canvas.addEventListener("mousedown", (e) => this.onDown(e));
    canvas.addEventListener("mousemove", (e) => this.onMove(e));
    window.addEventListener("mouseup", (e) => this.onUp(e));
  }

  /** Mouse position in px relative to the anchor. */
  private toRel(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this.cx) / this.scale,
      y: (e.clientY - r.top - this.cy) / this.scale,
    };
  }

  private context(): { step: ReturnType<typeof selectedStep>; frame: FrameDef | null } | null {
    const step = selectedStep();
    if (!step) return null;
    const frame = state.frames.find((f) => f.id === step.frame) ?? null;
    return { step, frame };
  }

  private onDown(e: MouseEvent): void {
    if (!this.context()) return;
    this.dragStart = this.toRel(e);
    this.dragBox = null;
  }

  private onMove(e: MouseEvent): void {
    if (!this.dragStart) return;
    const p = this.toRel(e);
    const start = this.dragStart;
    this.dragBox = {
      type: state.boxType,
      x: Math.round(Math.min(start.x, p.x)),
      y: Math.round(Math.min(start.y, p.y)),
      w: Math.round(Math.abs(p.x - start.x)),
      h: Math.round(Math.abs(p.y - start.y)),
    };
    this.redraw();
  }

  private onUp(e: MouseEvent): void {
    if (!this.dragStart) return;
    const ctx = this.context();
    const box = this.dragBox;
    this.dragStart = null;
    this.dragBox = null;
    if (!ctx || !ctx.step) return;

    if (box && box.w >= 2 && box.h >= 2) {
      ctx.step.boxes.push({ ...box });
      state.selectedBoxIndex = ctx.step.boxes.length - 1;
      emitChange();
      return;
    }
    // A click: select the topmost box under the cursor (or deselect).
    const p = this.toRel(e);
    let hit: number | null = null;
    for (let i = ctx.step.boxes.length - 1; i >= 0; i--) {
      const b = ctx.step.boxes[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        hit = i;
        break;
      }
    }
    state.selectedBoxIndex = hit;
    emitChange();
  }

  redraw(): void {
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#202028";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Anchor crosshair.
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cx - 6, this.cy);
    ctx.lineTo(this.cx + 6, this.cy);
    ctx.moveTo(this.cx, this.cy - 6);
    ctx.lineTo(this.cx, this.cy + 6);
    ctx.stroke();

    const c = this.context();
    if (!c || !c.step) return;
    const src = getSource();
    const s = this.scale;

    if (src && c.frame) {
      const dx = this.cx - c.frame.anchor[0] * s;
      const dy = this.cy - c.frame.anchor[1] * s;
      ctx.drawImage(src, c.frame.x, c.frame.y, c.frame.w, c.frame.h, dx, dy, c.frame.w * s, c.frame.h * s);
    }

    c.step.boxes.forEach((b, i) => this.drawBox(b, i === state.selectedBoxIndex));
    if (this.dragBox) this.drawBox(this.dragBox, true, true);
  }

  private drawBox(b: Box, selected: boolean, dashed = false): void {
    const { ctx } = this;
    const s = this.scale;
    const x = this.cx + b.x * s;
    const y = this.cy + b.y * s;
    const w = b.w * s;
    const h = b.h * s;
    const color = BOX_COLORS[b.type] ?? "#ffffff";
    ctx.fillStyle = rgbaFromHex(color, 0.18);
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = color;
    if (dashed) ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.setLineDash([]);
  }
}

function rgbaFromHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
