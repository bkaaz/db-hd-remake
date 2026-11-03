/**
 * Burning — the original's fire on whoever a Kamehameha hits (docs/rom.md,
 * `$0D:EC98`): the sprite is drawn from the same frames in one fire palette
 * after another, a step every 2 frames round all of them, until the body
 * lands (`$0D:CB47`). The sheets are drawn by the export; this only says which.
 */

/** Frames each fire palette shows before the next ($0D:ECA7: every second frame). */
const FRAMES_EACH = 2;

/** Which of a fighter's burn variants shows `frame` frames into its burning. */
export function burnVariant(variants: readonly string[], frame: number): string | undefined {
  if (variants.length === 0) return undefined;
  return variants[Math.floor(frame / FRAMES_EACH) % variants.length];
}

/** Frames each palette of an object's run shows ($01:84EF is asked every 4th frame). */
const SHIMMER_EACH = 4;

/**
 * Which of an object's `shimmer` variants shows `frame` frames into its life
 * — undefined for its own palette, the run's first.
 */
export function shimmerVariant(variants: readonly string[], frame: number): string | undefined {
  if (variants.length === 0) return undefined;
  const at = Math.floor(frame / SHIMMER_EACH) % (variants.length + 1);
  return at === 0 ? undefined : variants[at - 1];
}

/**
 * The glow a charging fighter is drawn in, under the arena's lighting
 * (`glow`, `evening_glow` …), or undefined when he has none — Goku's
 * records point back at his own (`rom/arena.ts`, `glowPalettes`).
 */
export function glowVariant(lighting: string | null, has: (variant: string) => boolean): string | undefined {
  const name = lighting === null ? "glow" : `${lighting}_glow`;
  return has(name) ? name : undefined;
}
