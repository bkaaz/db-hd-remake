/**
 * A blow that colours whoever it hits — the original's fire on a Kamehameha's
 * victim (docs/rom.md): the defender's sprite is drawn from another sheet of
 * the same frames in another palette, step by step, then from its own again.
 * The sheets are drawn by the export; this only says which one, when.
 */

/** Palette variants and how many frames each is shown, in order: `[["fire4", 10], …]`. */
export type PaletteRun = [string, number][];

/** Which variant shows `frame` frames after the blow landed, or null once the run is over. */
export function variantAt(run: PaletteRun, frame: number): string | null {
  let end = 0;
  for (const [variant, frames] of run) {
    end += frames;
    if (frame < end) return variant;
  }
  return null;
}
