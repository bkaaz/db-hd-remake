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
