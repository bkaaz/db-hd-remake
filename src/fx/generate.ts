/**
 * Generated effect sprites — starbursts drawn as pixel art, not as vector art.
 *
 * We could not find a ripped hit spark for Hyper Dimension, so we draw our own.
 * The rules that keep it from looking like a modern engine bolted onto 1996 art:
 *
 * - **One pixel is one sprite pixel.** Everything here works on a small integer
 *   grid; the engine scales it up with nearest-neighbour, so an effect pixel is
 *   exactly the size of a character pixel.
 * - **No antialiasing and no alpha ramp.** Every pixel is one palette index or
 *   nothing. Soft edges are what give a drawn-today effect away.
 * - **The palette is the game's**, sampled from the ripped effects sheet, so the
 *   colours cannot drift away from the source art.
 * - **Edges are dithered, not blended** — the same checkerboard the SNES used to
 *   fake transparency, and the same one visible on Goku's own sprites.
 * - **Deterministic**: a seed gives the same sprite every run, so regenerating
 *   never silently changes the art.
 *
 * Pure: no PixiJS, no filesystem. `scripts/fx.ts` turns these grids into a PNG.
 */

/** Palette index 0 is transparent; the rest are the game's own colours. */
export const FX_PALETTE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], // 0 — transparent, never written
  [248, 248, 248], // 1 — white, the core
  [248, 248, 176], // 2 — pale yellow
  [240, 232, 104], // 3 — yellow, the body of the burst
  [240, 200, 64], // 4 — gold, the rim and the speckles
  [232, 112, 24], // 5 — orange, late frames
  [192, 64, 16], // 6 — dark orange, the last fragments
] as const;

/** A square sprite as palette indices, row-major. */
export interface Grid {
  size: number;
  px: Uint8Array;
}

/** One frame's shape. All lengths are in sprite pixels. */
export interface BurstParams {
  /** Distance from the centre to the tip of a spike. */
  reach: number;
  /** Radius of the valleys between spikes, as a fraction of `reach`. */
  valley: number;
  /** How far the solid core extends, as a fraction of the local radius. 0 = hollow. */
  core: number;
  /** Colour of the core, the body and the rim (palette indices). */
  colors: readonly [number, number, number];
  /** Gold speckles scattered inside the core — the source art has a few. */
  speckles?: number;
  /** Hollow frames keep only this fraction of the radius as a shell. */
  shell?: number;
  /**
   * How quickly an arm narrows to its point. Low values give broad bumps on a
   * round body (an explosion); high values give thin rays sticking out of a
   * core (a spark). This one number is most of the difference between the two.
   */
  taper?: number;
  /** Direction of the long axis, in radians, when the burst is squashed. */
  axis?: number;
  /**
   * How far the burst is squashed across `axis`: the short side as a fraction
   * of the long one. 1 is round. Squashing happens **here**, while drawing, and
   * never by scaling or rotating the finished sprite — a pixel rotated by
   * anything but a right angle stops being square, which is exactly the tell
   * that makes generated art look bolted on. Values above 1 are refused: the
   * grid is sized for `reach`, and a stretched burst would be clipped by it.
   */
  squash?: number;
}

/** Deterministic 32-bit PRNG (mulberry32): one seed, one sprite, every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw one starburst.
 *
 * The outline is a ring of `spikes` arms of uneven length: the radius at an
 * angle interpolates from the valley up to the nearest arm's tip, sharpened so
 * the arms come to a point rather than bulging. Unevenness is what stops it
 * reading as a snowflake — a real impact is not symmetrical.
 */
export function burst(size: number, seed: number, p: BurstParams, spikes = 8): Grid {
  const px = new Uint8Array(size * size);
  const c = (size - 1) / 2;
  const rand = rng(seed);

  // Arm directions and lengths, fixed up front so every pixel sees the same shape.
  // Arms stay long relative to `reach`: the reference flash is a solid blob with
  // spikes on it, not a starfish, and short arms made it read as confetti.
  const arms = Array.from({ length: spikes }, (_, i) => ({
    angle: ((i + rand() * 0.5 - 0.25) / spikes) * Math.PI * 2,
    len: p.reach * (0.82 + rand() * 0.18),
  }));

  const [coreColor, bodyColor, rimColor] = p.colors;

  // Squashing is a change of coordinates, not a change of shape: measure the
  // pixel in a frame rotated onto `axis` and stretched across it, then run the
  // ordinary round-burst test. Everything downstream stays on the pixel grid.
  const squash = Math.min(1, p.squash ?? 1);
  const cs = Math.cos(-(p.axis ?? 0));
  const sn = Math.sin(-(p.axis ?? 0));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ox = x - c;
      const oy = y - c;
      const dx = ox * cs - oy * sn;
      const dy = (ox * sn + oy * cs) / squash;
      const d = Math.hypot(dx, dy);
      if (d > p.reach + 1) continue;
      const a = Math.atan2(dy, dx);

      // Local radius: the tallest arm that reaches this angle wins.
      let r = p.reach * p.valley;
      for (const arm of arms) {
        let da = Math.abs(a - arm.angle) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        const half = Math.PI / spikes;
        if (da >= half) continue;
        const falloff = (1 - da / half) ** (p.taper ?? 1.6);
        r = Math.max(r, p.reach * p.valley + (arm.len - p.reach * p.valley) * falloff);
      }

      if (d > r) continue;
      // Only the last half pixel is dithered away, on one parity. A wider band
      // eats the whole silhouette and the burst reads as scattered confetti
      // instead of a flash with a chewed edge.
      if (d > r - 0.6 && (x + y) % 2 === 0) continue;
      if (p.shell !== undefined && d < r * p.shell) continue;

      const core = r * p.core;
      px[y * size + x] = d <= core ? coreColor : d <= r - 1.4 ? bodyColor : rimColor;
    }
  }

  // Speckles sit inside the core, never on the rim, so they read as detail
  // rather than as noise eating the outline.
  for (let i = 0; i < (p.speckles ?? 0); i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * p.reach * p.core * 0.8;
    const x = Math.round(c + Math.cos(a) * d);
    const y = Math.round(c + Math.sin(a) * d);
    if (x >= 0 && y >= 0 && x < size && y < size && px[y * size + x] !== 0) {
      px[y * size + x] = 4;
    }
  }

  return { size, px };
}

/**
 * A hit spark: the flash a physical blow leaves where it lands.
 *
 * Not an explosion, and the difference is mostly *timing and colour*, not shape.
 * A spark arrives at nearly full size — it does not bloom, it flashes — stays
 * white, and is gone in well under a fifth of a second. An arc that grows, cools
 * through orange and ends as a ring reads as a small detonation however right
 * the silhouette is, which is exactly how the first attempt went wrong.
 *
 * Silhouette taken from a screenshot of the original: a solid, irregular white
 * mass about 20 sprite px across with a ragged yellow fringe. The rays come from
 * a high `taper`, which narrows each arm to a point instead of bulging it.
 */
/** How a single spark differs from the plain round one. */
export interface SparkOptions {
  /** Direction of the long axis, in radians. */
  axis?: number;
  /** Short side as a fraction of the long one; 1 is round. */
  squash?: number;
  /** Number of rays. Fewer and longer, or more and finer. */
  spikes?: number;
  /**
   * How much of the middle is missing from the start, 0–1. At 0 the spark has a
   * solid core and only opens as it dies; raise it and it is a ring from its
   * first frame. Varying this between variants changes the character of a hit
   * far more than the outline does.
   */
  open?: number;
  /** Force the grid size, so variants of different sizes still share a sheet. */
  size?: number;
}

/** The largest a spark's step multiplier goes — the tail disperses outwards. */
const SPARK_MAX_STEP = 1.15;

/** Grid a spark of this reach needs, big enough for its widest frame. */
export function sparkSize(reach: number): number {
  return Math.ceil(reach * SPARK_MAX_STEP * 2) + 3;
}

export function spark(reach: number, seed: number, opts: SparkOptions = {}): Grid[] {
  const { axis = 0, squash = 1, spikes, open = 0, size = sparkSize(reach) } = opts;
  const flash = [1, 1, 2] as const;
  const fading = [1, 2, 3] as const;
  const last = [2, 3, 4] as const;

  // **It arrives at full size and then goes out.** There is no growth phase, for
  // a reason that is specific to this engine: hitstop freezes effects too, so
  // the first frame is held for the whole pause — the moment the player is
  // actually looking at the impact. A spark that grew would spend that moment
  // showing its smallest, dimmest frame and only flash once the freeze was over.
  //
  // What survives from growing is the part worth keeping: it **opens**, emptying
  // from the middle outwards. The slight widening across the tail is dispersal,
  // not a bloom.
  const steps: (BurstParams & { spikes: number })[] = [
    { reach, valley: 0.42, core: 0.62, colors: flash, taper: 4, speckles: 2, spikes: 7 },
    { reach: reach * 1.05, valley: 0.42, core: 0.25, colors: flash, taper: 4.5, shell: 0.32, spikes: 7 },
    { reach: reach * 1.1, valley: 0.4, core: 0, colors: fading, taper: 5, shell: 0.55, spikes: 7 },
    // The tail thins rather than shrinking: a small dense blob reads as a solid
    // object sitting on the fighter, the opposite of a spark dying.
    { reach: reach * 1.15, valley: 0.3, core: 0, colors: last, taper: 6, shell: 0.7, spikes: 6 },
  ];

  // `open` hollows the whole sequence: it eats into the core and lifts the
  // shell, so a variant can be a ring from its first frame instead of only
  // becoming one as it dies.
  return steps.map((s, i) =>
    burst(
      size,
      seed + i,
      {
        ...s,
        axis,
        squash,
        core: Math.max(0, s.core - open),
        shell: open > 0 || s.shell !== undefined ? Math.min(0.8, (s.shell ?? 0) + open) : undefined,
      },
      spikes ?? s.spikes,
    ),
  );
}

/**
 * A set of sparks that differ visibly from each other, so a run of hits does not
 * look like the same stamp printed over and over.
 *
 * Angles are **spread evenly rather than drawn at random**: with only a handful
 * of variants, random angles cluster and half the work is wasted, while an even
 * spread guarantees each one reads as a different direction of impact. The
 * randomness belongs at the moment of the hit — the engine picks one — not here.
 * A squash axis repeats every half turn, so the spread covers 180°, not 360°.
 */
export function sparkVariants(reach: number, seed: number, count: number): Grid[][] {
  // A different squash axis alone is too subtle at this size — several hits in a
  // row still read as one repeated stamp. So each variant is its own character:
  // how big, how many rays, how flat, and whether it has a middle at all.
  const shapes: (SparkOptions & { scale: number })[] = [
    { scale: 1, spikes: 7, squash: 0.74, open: 0 },
    { scale: 1.22, spikes: 6, squash: 0.58, open: 0 },
    { scale: 0.78, spikes: 9, squash: 0.84, open: 0.34 },
    { scale: 1.08, spikes: 8, squash: 0.64, open: 0.18 },
  ];

  const pick = (i: number) => shapes[i % shapes.length];
  // One grid for all of them, sized for the largest, so they tile into a sheet.
  const size = sparkSize(reach * Math.max(...Array.from({ length: count }, (_, i) => pick(i).scale)));

  return Array.from({ length: count }, (_, i) => {
    const s = pick(i);
    return spark(reach * s.scale, seed + i * 100, { ...s, axis: (i / count) * Math.PI, size });
  });
}

/**
 * An explosion: blooms, cools from white through gold to orange, and ends as a
 * broken ring of embers. Wrong for a punch — see `spark` — but this is what a
 * ki blast or a special landing should leave behind, so it stays.
 */
export function explosion(reach: number, seed: number): Grid[] {
  const size = Math.ceil(reach * 2) + 3;
  // In the original the flash is white with only a thin yellow fringe, so the
  // bright frames make the *body* white too and leave yellow to the rim alone.
  const spark = [1, 2, 3] as const;
  const flash = [1, 1, 3] as const;
  const hot = [1, 3, 4] as const;
  const cooling = [3, 4, 5] as const;
  const embers = [4, 5, 6] as const;
  return [
    burst(size, seed, { reach: reach * 0.5, valley: 0.8, core: 0.72, colors: spark }, 6),
    burst(size, seed + 1, { reach: reach * 0.82, valley: 0.76, core: 0.72, colors: flash, speckles: 2 }, 8),
    burst(size, seed + 2, { reach, valley: 0.72, core: 0.7, colors: flash, speckles: 3 }, 9),
    burst(size, seed + 3, { reach: reach * 0.97, valley: 0.74, core: 0.45, colors: hot, speckles: 3 }, 9),
    burst(size, seed + 4, { reach: reach * 0.88, valley: 0.78, core: 0, colors: cooling, shell: 0.5 }, 8),
    burst(size, seed + 5, { reach: reach * 0.72, valley: 0.82, core: 0, colors: embers, shell: 0.7 }, 7),
  ];
}

/** Tight bounding box of the non-empty pixels, or null when the grid is empty. */
export function bounds(g: Grid): { x: number; y: number; w: number; h: number } | null {
  let minX = g.size;
  let minY = g.size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (g.px[y * g.size + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
