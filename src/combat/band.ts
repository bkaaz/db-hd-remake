/**
 * The band of light from a beam's base to its head — the original's `b1`
 * effect of kind 1 (docs/rom.md): added light like the charging ball, drawn by
 * the fighter holding the beam, as far as the head has flown. Separate from
 * the head because the head is a bolt that hits, and the band only shows how
 * far it reached.
 */

/**
 * A state's band: where it starts, how thick it starts and how thick it gets.
 *
 * Not a rectangle: the original writes `4 × size` lines, the middle half the
 * whole length and the outer ones shortened from the base end in proportion
 * ($2A:A4B6) — a band `2 × size` tall at the hands opening to `4 × size` at
 * the head.
 */
export interface BandDef {
  /** The base, from the fighter's position, px, x facing-relative. */
  from: [number, number];
  /** `b1`'s size; the band is 4 px tall per unit of it. */
  size: number;
  /** What the head lets it thicken to, by 1 every 8 frames ($0F:B63D). */
  max: number;
  /** `b1` kind 4, the small shot's: `2 × size` tall all along, no opening ($2A:A78D). */
  flat?: boolean;
}

const THICKEN_EVERY = 8;

/**
 * How tall the band is at the hands and at the head, in sprite px, `frames`
 * after it appeared — and, `gone` frames after its head is gone, one size
 * thinner a frame where it stands ($2A:A3F7, set going by `$0F:B4ED` as the
 * head's slot is freed), down to nothing.
 */
export function bandHeights(def: BandDef, frames: number, gone = 0): { base: number; head: number } {
  const size = Math.max(0, Math.min(def.max, def.size + Math.floor(frames / THICKEN_EVERY)) - gone);
  return { base: 2 * size, head: (def.flat ? 2 : 4) * size };
}
