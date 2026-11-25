import { labelOf } from "../combat/rushAddress";
import { ENDERS, SLOTS, type BlowAnim, type Picks, type Slot } from "../combat/rushSlots";
import type { Box, FrameDef } from "../entity/entityFile";

/**
 * A slot's blow at a glance (`rushPicks.ts`): the drawing it lands with and
 * its hit box over it — a name and a row of pose numbers are easy to lose
 * your way in. Drawn on a canvas of its own from his sheet, as the editor
 * draws, no PixiJS.
 */

/** Px of the thumbnail's height; the drawing is scaled to fit it. */
const HEIGHT = 56;
const HIT = "#ff4d4d";

/** The step a blow lands on: the first with a hit box, else its first. */
function landing(anim: BlowAnim): BlowAnim["steps"][number] | undefined {
  return anim.steps.find((s) => (s.boxes ?? []).some((b) => b.type === "hit")) ?? anim.steps[0];
}

/** Each picked slot's thumbnail: Attack's line on one row, Smash's enders under it; none until his sheet is drawn. */
export function blowThumbs(picks: Picks, anims: Record<string, BlowAnim>, sheet: HTMLCanvasElement | null, frames: Record<string, FrameDef>): HTMLElement {
  const rows = document.createElement("span");
  rows.className = "thumbs";
  for (const row of [SLOTS.filter((s) => !(ENDERS as readonly Slot[]).includes(s)), ENDERS]) {
    const line = document.createElement("span");
    if (sheet) line.append(...row.filter((s) => picks[s]).map((s) => blowThumb(labelOf(s), anims[picks[s]!.anim], sheet, frames)));
    rows.append(line);
  }
  return rows;
}

/** `anim`'s landing drawn under `label`, or an empty square when there is nothing to draw. */
export function blowThumb(label: string, anim: BlowAnim | undefined, sheet: HTMLCanvasElement, frames: Record<string, FrameDef>): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "thumb";
  const canvas = document.createElement("canvas");
  const step = anim && landing(anim);
  const frame = step && frames[step.frame];
  if (step && frame) draw(canvas, sheet, frame, (step.boxes ?? []).filter((b) => b.type === "hit") as Box[]);
  else Object.assign(canvas, { width: HEIGHT / 2, height: HEIGHT });
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(canvas, caption);
  return figure;
}

/** The frame and its hit boxes, anchor-relative as the game places them, in one box scaled to fit. */
function draw(canvas: HTMLCanvasElement, sheet: HTMLCanvasElement, f: FrameDef, hits: Box[]): void {
  // everything in anchor-relative px: the drawing, then each box
  const rects = [{ x: -f.anchor[0], y: -f.anchor[1], w: f.w, h: f.h }, ...hits];
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const width = Math.max(...rects.map((r) => r.x + r.w)) - left;
  const height = Math.max(...rects.map((r) => r.y + r.h)) - top;
  const k = HEIGHT / height;
  canvas.width = Math.ceil(width * k);
  canvas.height = Math.ceil(height * k);
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(sheet, f.x, f.y, f.w, f.h, (-f.anchor[0] - left) * k, (-f.anchor[1] - top) * k, f.w * k, f.h * k);
  g.strokeStyle = HIT;
  g.lineWidth = 1;
  for (const b of hits) g.strokeRect(Math.round((b.x - left) * k) + 0.5, Math.round((b.y - top) * k) + 0.5, Math.round(b.w * k) - 1, Math.round(b.h * k) - 1);
}
