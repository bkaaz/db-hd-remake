import {
  state,
  emitChange,
  nextFrameId,
  selectedFrame,
  addFrameFromRect,
  type FrameDef,
} from "./store";
import { getSource, pickColorAt, rebuildKeyed } from "./imageProcess";
import { detectAt } from "./detect";

/**
 * The left-hand sheet canvas: draws the loaded sprite sheet with frame
 * rectangles + anchors overlaid, and handles the drawing / selecting /
 * anchor-setting interactions.
 *
 * Transient drag state lives here (not in the store) so dragging only redraws
 * the canvas and doesn't trigger a full UI rebuild on every mouse move.
 */
export class SheetView {
  private ctx: CanvasRenderingContext2D;
  private dragStart: { x: number; y: number } | null = null;
  private dragRect: { x: number; y: number; w: number; h: number } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;

    canvas.addEventListener("mousedown", (e) => this.onDown(e));
    canvas.addEventListener("mousemove", (e) => this.onMove(e));
    // Listen on window so a drag that ends outside the canvas still commits.
    window.addEventListener("mouseup", (e) => this.onUp(e));
  }

  /** Convert a mouse event to image-pixel coordinates. */
  private toImage(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / state.scale,
      y: (e.clientY - rect.top) / state.scale,
    };
  }

  private onDown(e: MouseEvent): void {
    if (!state.image) return;
    const p = this.toImage(e);

    if (state.mode === "bg") {
      // Eyedropper: pick the background color, enable keying, return to framing.
      pickColorAt(p.x, p.y);
      state.bgKeyEnabled = true;
      rebuildKeyed();
      state.mode = "frame";
      emitChange();
      return;
    }

    if (state.mode === "detect") {
      // Magic click: detect the sprite under the cursor as one frame.
      const rect = detectAt(p.x, p.y, {
        gap: state.detectGap,
        minArea: state.detectMinArea,
      });
      if (rect) {
        const frame = addFrameFromRect(rect);
        state.selectedFrameId = frame.id;
        emitChange();
      }
      return;
    }

    if (state.mode === "anchor") {
      const f = selectedFrame();
      if (f) {
        f.anchor = [clamp(p.x - f.x, 0, f.w), clamp(p.y - f.y, 0, f.h)];
        f.anchor = [Math.round(f.anchor[0]), Math.round(f.anchor[1])];
        emitChange();
      }
      return;
    }

    // Frame mode: start a potential drag (or a click-select on mouseup).
    this.dragStart = p;
    this.dragRect = null;
  }

  private onMove(e: MouseEvent): void {
    if (!state.image || this.dragStart === null) return;
    const p = this.toImage(e);
    const start = this.dragStart;
    this.dragRect = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    };
    this.redraw();
  }

  private onUp(e: MouseEvent): void {
    if (this.dragStart === null || !state.image) {
      this.dragStart = null;
      this.dragRect = null;
      return;
    }
    const rect = this.dragRect;
    this.dragStart = null;
    this.dragRect = null;

    if (rect && rect.w >= 3 && rect.h >= 3) {
      // Commit a new frame; default anchor at bottom-center (feet).
      const frame: FrameDef = {
        id: nextFrameId(),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.w),
        h: Math.round(rect.h),
        anchor: [Math.round(rect.w / 2), Math.round(rect.h)],
      };
      state.frames.push(frame);
      state.selectedFrameId = frame.id;
    } else {
      // A click (no meaningful drag): select the frame under the cursor.
      const p = this.toImage(e);
      const hit = [...state.frames]
        .reverse()
        .find((f) => p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h);
      state.selectedFrameId = hit ? hit.id : null;
    }
    emitChange();
  }

  /** Size the canvas to the image at the current zoom. */
  resize(): void {
    if (!state.image) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      return;
    }
    this.canvas.width = Math.round(state.image.width * state.scale);
    this.canvas.height = Math.round(state.image.height * state.scale);
  }

  redraw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.image) return;

    const s = state.scale;
    ctx.imageSmoothingEnabled = false;
    const source = getSource() ?? state.image;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const f of state.frames) {
      const selected = f.id === state.selectedFrameId;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? "#ffcc00" : "#00e0ff";
      ctx.strokeRect(f.x * s + 0.5, f.y * s + 0.5, f.w * s, f.h * s);

      const ax = (f.x + f.anchor[0]) * s;
      const ay = (f.y + f.anchor[1]) * s;
      ctx.strokeStyle = selected ? "#ff3366" : "#ff88aa";
      ctx.beginPath();
      ctx.moveTo(ax - 5, ay);
      ctx.lineTo(ax + 5, ay);
      ctx.moveTo(ax, ay - 5);
      ctx.lineTo(ax, ay + 5);
      ctx.stroke();
    }

    if (this.dragRect) {
      const r = this.dragRect;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffffff";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(r.x * s + 0.5, r.y * s + 0.5, r.w * s, r.h * s);
      ctx.setLineDash([]);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
