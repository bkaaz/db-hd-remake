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

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeOrig {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
}

type Drag =
  | { kind: "new"; start: { x: number; y: number } }
  | { kind: "move"; id: string; grabX: number; grabY: number }
  | { kind: "resize"; id: string; handle: Handle; orig: ResizeOrig };

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
  private drag: Drag | null = null;
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

  /** The 8 resize handles of a frame, in image coordinates. */
  private handlePoints(f: FrameDef): { id: Handle; x: number; y: number }[] {
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    return [
      { id: "nw", x: f.x, y: f.y },
      { id: "n", x: cx, y: f.y },
      { id: "ne", x: f.x + f.w, y: f.y },
      { id: "e", x: f.x + f.w, y: cy },
      { id: "se", x: f.x + f.w, y: f.y + f.h },
      { id: "s", x: cx, y: f.y + f.h },
      { id: "sw", x: f.x, y: f.y + f.h },
      { id: "w", x: f.x, y: cy },
    ];
  }

  private hitHandle(f: FrameDef, p: { x: number; y: number }): Handle | null {
    const tol = 7 / state.scale;
    for (const h of this.handlePoints(f)) {
      if (Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol) return h.id;
    }
    return null;
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
        minSide: state.detectMinSide,
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
        f.anchor = [
          Math.round(clamp(p.x - f.x, 0, f.w)),
          Math.round(clamp(p.y - f.y, 0, f.h)),
        ];
        emitChange();
      }
      return;
    }

    // Frame mode. On the selected frame: a handle resizes, the interior moves.
    const sel = selectedFrame();
    if (sel) {
      const handle = this.hitHandle(sel, p);
      if (handle) {
        this.drag = {
          kind: "resize",
          id: sel.id,
          handle,
          orig: { x: sel.x, y: sel.y, w: sel.w, h: sel.h, anchor: [sel.anchor[0], sel.anchor[1]] },
        };
        return;
      }
      if (p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h) {
        this.drag = { kind: "move", id: sel.id, grabX: p.x - sel.x, grabY: p.y - sel.y };
        return;
      }
    }
    // Otherwise start a new-frame drag (or a click-select on mouseup).
    this.drag = { kind: "new", start: p };
    this.dragRect = null;
  }

  private onMove(e: MouseEvent): void {
    if (!state.image || !this.drag) return;
    const p = this.toImage(e);
    const img = state.image;

    const drag = this.drag;
    if (drag.kind === "new") {
      const s = drag.start;
      this.dragRect = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      };
      this.redraw();
      return;
    }

    const f = state.frames.find((fr) => fr.id === drag.id);
    if (!f) return;

    if (drag.kind === "move") {
      f.x = Math.round(clamp(p.x - drag.grabX, 0, img.width - f.w));
      f.y = Math.round(clamp(p.y - drag.grabY, 0, img.height - f.h));
      this.redraw();
      return;
    }

    // resize: move the edges named by the handle; keep the anchor pixel-fixed.
    const o = drag.orig;
    const hd = drag.handle;
    let left = o.x;
    let right = o.x + o.w;
    let top = o.y;
    let bottom = o.y + o.h;
    if (hd.includes("w")) left = clamp(Math.round(p.x), 0, right - 2);
    if (hd.includes("e")) right = clamp(Math.round(p.x), left + 2, img.width);
    if (hd.includes("n")) top = clamp(Math.round(p.y), 0, bottom - 2);
    if (hd.includes("s")) bottom = clamp(Math.round(p.y), top + 2, img.height);
    f.x = left;
    f.y = top;
    f.w = right - left;
    f.h = bottom - top;
    const absX = o.x + o.anchor[0];
    const absY = o.y + o.anchor[1];
    f.anchor = [
      clamp(Math.round(absX - f.x), 0, f.w),
      clamp(Math.round(absY - f.y), 0, f.h),
    ];
    this.redraw();
  }

  private onUp(e: MouseEvent): void {
    const drag = this.drag;
    const rect = this.dragRect;
    this.drag = null;
    this.dragRect = null;
    if (!drag || !state.image) return;

    if (drag.kind === "new") {
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

      // Frame number label (fixed screen size, dark backing for legibility).
      const label = f.id;
      ctx.font = "10px monospace";
      ctx.textBaseline = "top";
      const tw = ctx.measureText(label).width;
      const lx = f.x * s;
      const ly = f.y * s;
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(lx, ly, tw + 4, 12);
      ctx.fillStyle = selected ? "#ffcc00" : "#00e0ff";
      ctx.fillText(label, lx + 2, ly + 1);

      // Resize handles on the selected frame.
      if (selected) {
        ctx.fillStyle = "#ffcc00";
        for (const h of this.handlePoints(f)) {
          ctx.fillRect(h.x * s - 3, h.y * s - 3, 6, 6);
        }
      }
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
