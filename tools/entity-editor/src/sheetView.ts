import { state, emitChange } from "./store";

/**
 * The left-hand sheet canvas: the entity's sheet as the ROM draws it, with the
 * export's frame rectangles and anchors over it. Read-only (ADR 0090): a click
 * selects the frame under it, nothing moves.
 */
export class SheetView {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    canvas.addEventListener("click", (e) => this.select(e));
  }

  private select(e: MouseEvent): void {
    if (!state.image) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.scale;
    const y = (e.clientY - rect.top) / state.scale;
    const hit = [...state.frames].reverse().find((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    state.selectedFrameId = hit ? hit.id : null;
    emitChange();
  }

  /** Size the canvas to the image at the current zoom. */
  resize(): void {
    this.canvas.width = state.image ? Math.round(state.image.width * state.scale) : 0;
    this.canvas.height = state.image ? Math.round(state.image.height * state.scale) : 0;
  }

  redraw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.image) return;

    const s = state.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);

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
      ctx.font = "10px monospace";
      ctx.textBaseline = "top";
      const tw = ctx.measureText(f.id).width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(f.x * s, f.y * s, tw + 4, 12);
      ctx.fillStyle = selected ? "#ffcc00" : "#00e0ff";
      ctx.fillText(f.id, f.x * s + 2, f.y * s + 1);
    }
  }
}
