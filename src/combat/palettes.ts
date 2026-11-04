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

/** Frames each palette of a fighter's run shows, the first a frame short ($20:B3CC counts from frame 1). */
const RUN_EACH = 4;

/** Which palette of a state's run shows on `frame` of it; undefined before and after. */
export function runVariant(variants: readonly string[], frame: number): string | undefined {
  return frame < 1 ? undefined : variants[Math.floor(frame / RUN_EACH)];
}

/** A state's palettes by its frame: from each mark on, that variant, null his own. */
export type PaletteMarks = [number, string | null][];

/** The variant the marks say on `frame`, in his alternate colours where it has them; undefined for his own. */
export function markedVariant(marks: PaletteMarks, frame: number, alt: boolean, has: (variant: string) => boolean): string | undefined {
  const name = marks.filter(([at]) => at <= frame).at(-1)?.[1];
  if (!name) return undefined;
  return alt && has(`${name}_alt`) ? `${name}_alt` : name;
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
 * The sheet a fighter is drawn in: the arena's lighting, his glow while he
 * charges or his winning colours in his pose, player two's own colours when
 * both sides are the same fighter ($01:82F2: the next record), and a colour
 * set of ours (`palettes.json`) — `night_glow_alt_gold`, read in that order.
 * A part he has no sheet for is dropped, the glow first: Goku has no glow
 * (`rom/arena.ts`). Null is his own colours.
 */
export function paletteVariant(
  want: { lighting: string | null; glow: boolean; win?: boolean; alt: boolean; set?: string | null },
  has: (variant: string) => boolean,
): string | null {
  const set = want.set ?? null;
  // the pose's colours take the glow's place: both are records past his own
  const mood = want.win ? "win" : "glow";
  const name = (glow: boolean, alt: boolean, s: string | null) =>
    [want.lighting, glow && mood, alt && "alt", s].filter(Boolean).join("_") || null;
  const lit = want.glow || !!want.win;
  const tries = [
    [lit, want.alt, set],
    [false, want.alt, set],
    [lit, want.alt, null],
    [false, want.alt, null],
    [false, false, null],
  ] as const;
  for (const [glow, alt, s] of tries) {
    const n = name(glow, alt, s);
    if (n === null || has(n)) return n;
  }
  return null;
}
