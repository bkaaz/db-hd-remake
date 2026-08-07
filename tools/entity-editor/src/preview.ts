import { state, selectedAnim } from "./store";
import { getSource } from "./imageProcess";

/**
 * Plays the currently selected animation in the small preview canvas.
 *
 * Timing is advanced in fixed 1/60s game frames (accumulator pattern) so that
 * step `dur` values read exactly as authored, independent of display refresh
 * rate. The animation is read live from the store each frame, so edits to
 * durations / frame order show up on the next play without extra wiring.
 */
export class Preview {
  private ctx: CanvasRenderingContext2D;
  private playing = false;
  private stepIndex = 0;
  private remaining = 0;
  private last = 0;
  private acc = 0;
  private readonly scale = 2;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  play(): void {
    this.playing = true;
    this.stepIndex = 0;
    this.remaining = this.currentStepDur();
    this.acc = 0;
    this.last = performance.now();
  }

  stop(): void {
    this.playing = false;
  }

  private currentStepDur(): number {
    const anim = selectedAnim();
    if (!anim || anim.steps.length === 0) return 0;
    const step = anim.steps[Math.min(this.stepIndex, anim.steps.length - 1)];
    return Math.max(1, step.dur);
  }

  private tick(now: number): void {
    const dt = (now - this.last) / 1000;
    this.last = now;

    if (this.playing) {
      this.acc += dt;
      const frameTime = 1 / 60;
      let guard = 0;
      while (this.acc >= frameTime && guard++ < 600) {
        this.acc -= frameTime;
        this.advance();
      }
    }

    this.draw();
    requestAnimationFrame((t) => this.tick(t));
  }

  private advance(): void {
    const anim = selectedAnim();
    if (!anim || anim.steps.length === 0) {
      this.playing = false;
      return;
    }
    this.remaining -= 1;
    if (this.remaining <= 0) {
      this.stepIndex += 1;
      if (this.stepIndex >= anim.steps.length) {
        if (anim.loop) {
          this.stepIndex = 0;
        } else {
          this.stepIndex = anim.steps.length - 1;
          this.playing = false;
        }
      }
      this.remaining = this.currentStepDur();
    }
  }

  private draw(): void {
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#202028";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseY = Math.round(canvas.height * 0.85);
    ctx.strokeStyle = "#444";
    ctx.beginPath();
    ctx.moveTo(0, baseY + 0.5);
    ctx.lineTo(canvas.width, baseY + 0.5);
    ctx.stroke();

    const anim = selectedAnim();
    if (!state.image || !anim || anim.steps.length === 0) return;

    const step = anim.steps[Math.min(this.stepIndex, anim.steps.length - 1)];
    const frame = state.frames.find((f) => f.id === step.frame);
    if (!frame) return;

    const s = this.scale;
    const dx = canvas.width / 2 - frame.anchor[0] * s;
    const dy = baseY - frame.anchor[1] * s;
    const source = getSource() ?? state.image;
    ctx.drawImage(
      source,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      dx,
      dy,
      frame.w * s,
      frame.h * s,
    );
  }
}
