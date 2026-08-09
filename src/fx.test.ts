import { describe, expect, it } from "vitest";
import { bounds, burst, explosion, FX_PALETTE, spark, sparkVariants, type Grid } from "./fx";

/**
 * The generator is pure, so what it draws is checked here rather than by eye.
 * These tests guard the properties that make it look like 1996 art — a closed
 * palette, hard edges, nothing running off the sprite — not whether it is
 * pretty, which stays with the owner.
 */

const filled = (g: Grid): number => g.px.reduce((n, v) => n + (v === 0 ? 0 : 1), 0);

/** Render a grid as text, for readable failures. */
const show = (g: Grid): string => {
  const rows: string[] = [];
  for (let y = 0; y < g.size; y++) {
    rows.push([...g.px.slice(y * g.size, (y + 1) * g.size)].map((v) => (v === 0 ? "." : v)).join(""));
  }
  return rows.join("\n");
};

describe("burst", () => {
  const params = { reach: 8, valley: 0.45, core: 0.6, colors: [1, 2, 3] as const };

  it("is deterministic — the same seed draws the same sprite", () => {
    const a = burst(19, 42, params);
    const b = burst(19, 42, params);
    expect([...a.px]).toEqual([...b.px]);
  });

  it("draws something different for a different seed", () => {
    const a = burst(19, 42, params);
    const b = burst(19, 7, params);
    expect([...a.px]).not.toEqual([...b.px]);
  });

  it("uses only palette indices that exist", () => {
    const g = burst(19, 42, params);
    for (const v of g.px) expect(v).toBeLessThan(FX_PALETTE.length);
  });

  it("never touches the edge of the sprite", () => {
    // A burst that bleeds off its own grid would be clipped in the atlas.
    const g = burst(19, 42, params);
    for (let i = 0; i < g.size; i++) {
      expect(g.px[i]).toBe(0); // top row
      expect(g.px[(g.size - 1) * g.size + i]).toBe(0); // bottom row
      expect(g.px[i * g.size]).toBe(0); // left column
      expect(g.px[i * g.size + g.size - 1]).toBe(0); // right column
    }
  });

  it("has a solid core of the core colour", () => {
    const g = burst(19, 42, params);
    const c = (g.size - 1) / 2;
    expect(g.px[c * g.size + c]).toBe(1);
  });

  it("leaves the middle empty when asked for a shell", () => {
    const g = burst(19, 42, { ...params, core: 0, shell: 0.6 });
    const c = (g.size - 1) / 2;
    expect(g.px[c * g.size + c]).toBe(0);
    expect(filled(g)).toBeGreaterThan(0);
  });

  it("grows with reach", () => {
    const small = filled(burst(29, 42, { ...params, reach: 5 }));
    const big = filled(burst(29, 42, { ...params, reach: 12 }));
    expect(big).toBeGreaterThan(small * 2);
  });

  it("chews its edge with dither, leaving bites in the outline", () => {
    // The edge is dithered on one parity, so the outline is full of single-pixel
    // notches: empty pixels with drawn neighbours on three sides. A burst drawn
    // with a clean outline has almost none of these.
    const g = burst(25, 3, { ...params, reach: 11 });
    let bites = 0;
    for (let y = 1; y < g.size - 1; y++) {
      for (let x = 1; x < g.size - 1; x++) {
        if (g.px[y * g.size + x] !== 0) continue;
        const drawn = [
          g.px[(y - 1) * g.size + x],
          g.px[(y + 1) * g.size + x],
          g.px[y * g.size + x - 1],
          g.px[y * g.size + x + 1],
        ].filter((v) => v !== 0).length;
        if (drawn >= 3) bites++;
      }
    }
    expect(bites, show(g)).toBeGreaterThan(6);
  });

  it("is not a circle — its radius varies with the angle", () => {
    // The widest and narrowest reach differ by an arm's worth. A round blob,
    // which is what this stops becoming, would have them within a pixel.
    const g = burst(25, 3, { ...params, reach: 11 });
    const c = (g.size - 1) / 2;
    let min = Infinity;
    let max = 0;
    for (let y = 0; y < g.size; y++) {
      for (let x = 0; x < g.size; x++) {
        const d = Math.hypot(x - c, y - c);
        if (g.px[y * g.size + x] !== 0) max = Math.max(max, d);
        else if (d < 12) min = Math.min(min, d);
      }
    }
    expect(max - min, show(g)).toBeGreaterThan(3);
  });
});

/** Width and height of the drawn pixels. */
const extent = (g: Grid): { w: number; h: number } => {
  const b = bounds(g);
  return b ? { w: b.w, h: b.h } : { w: 0, h: 0 };
};

describe("burst squash", () => {
  const base = { reach: 10, valley: 0.45, core: 0.6, colors: [1, 2, 3] as const };

  it("squashes across the axis, leaving the axis itself full length", () => {
    const flat = burst(25, 5, { ...base, axis: 0, squash: 0.5 });
    const { w, h } = extent(flat);
    expect(w).toBeGreaterThan(h * 1.5);
  });

  it("follows the axis it is given", () => {
    const upright = burst(25, 5, { ...base, axis: Math.PI / 2, squash: 0.5 });
    const { w, h } = extent(upright);
    expect(h).toBeGreaterThan(w * 1.5);
  });

  it("is round when it is not squashed", () => {
    const { w, h } = extent(burst(25, 5, { ...base, squash: 1 }));
    expect(Math.abs(w - h)).toBeLessThan(4);
  });

  it("refuses to stretch, which would clip against the sprite's edge", () => {
    // Values above 1 are clamped rather than honoured: the grid is sized for
    // `reach`, so a stretched burst would simply lose its tips in the atlas.
    const stretched = burst(25, 5, { ...base, axis: 0, squash: 3 });
    const round = burst(25, 5, { ...base, squash: 1 });
    expect([...stretched.px]).toEqual([...round.px]);
  });
});

describe("sparkVariants", () => {
  it("draws the number asked for", () => {
    expect(sparkVariants(9, 1, 4)).toHaveLength(4);
  });

  it("makes them visibly different from one another", () => {
    const [a, b] = sparkVariants(9, 1, 4);
    expect([...a[0].px]).not.toEqual([...b[0].px]);
  });

  it("spreads them over half a turn — a squash axis repeats every 180°", () => {
    // Opposite ends of the spread must not come out as the same sprite, which
    // is what a full-circle spread would produce.
    const v = sparkVariants(9, 1, 2);
    expect([...v[0][0].px]).not.toEqual([...v[1][0].px]);
  });
});

describe("spark", () => {
  // These are the three things that make a spark read as an impact rather than
  // as a small detonation. The first attempt failed all three.

  it("arrives at full size — hitstop holds frame 0, so it must be the big one", () => {
    // Effects freeze during a hit pause, so the first frame is what the player
    // stares at for the whole impact. A spark that bloomed would spend that
    // moment showing its smallest frame. Measured on the outline, not on the
    // pixel count: it hollows out later, covering fewer pixels while as wide.
    const frames = spark(9, 1);
    const reachOf = (g: Grid): number => {
      const c = (g.size - 1) / 2;
      let max = 0;
      for (let y = 0; y < g.size; y++) {
        for (let x = 0; x < g.size; x++) {
          if (g.px[y * g.size + x] !== 0) max = Math.max(max, Math.hypot(x - c, y - c));
        }
      }
      return max;
    };
    const reaches = frames.map(reachOf);
    expect(reaches[0]).toBeGreaterThan(Math.max(...reaches) * 0.85);
  });

  it("opens from the middle: solid at first, hollow at the end", () => {
    const frames = spark(9, 1);
    // Floor, because an even grid puts the true centre between pixels — and an
    // out-of-range index reads as undefined, which quietly satisfies "not 0".
    const middle = (g: Grid): number | undefined => {
      const c = Math.floor((g.size - 1) / 2);
      return g.px[c * g.size + c];
    };
    expect(middle(frames[0])).toBeGreaterThan(0);
    expect(middle(frames[frames.length - 1])).toBe(0);
  });

  it("never cools to orange — a physical blow flashes white, it does not burn", () => {
    for (const g of spark(9, 1)) {
      for (const v of g.px) expect(v).toBeLessThan(5);
    }
  });

  it("is short", () => {
    expect(spark(9, 1).length).toBeLessThanOrEqual(4);
  });

  it("never runs off its own sprite, however far it expands", () => {
    for (const g of spark(9, 1)) {
      for (let i = 0; i < g.size; i++) {
        expect(g.px[i]).toBe(0);
        expect(g.px[(g.size - 1) * g.size + i]).toBe(0);
        expect(g.px[i * g.size]).toBe(0);
        expect(g.px[i * g.size + g.size - 1]).toBe(0);
      }
    }
  });
});

describe("explosion", () => {
  it("blooms and then breaks apart", () => {
    const frames = explosion(9, 1);
    expect(frames).toHaveLength(6);
    const sizes = frames.map(filled);
    // First frame small, third frame the peak, last frame smaller than the peak.
    expect(sizes[0]).toBeLessThan(sizes[2]);
    expect(sizes[5]).toBeLessThan(sizes[2]);
  });

  it("loses its white core by the end", () => {
    const frames = explosion(9, 1);
    const white = (g: Grid) => g.px.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    expect(white(frames[0])).toBeGreaterThan(0);
    expect(white(frames[5])).toBe(0);
  });

  it("keeps every frame on one grid size, so the atlas rows line up", () => {
    const frames = explosion(9, 1);
    for (const f of frames) expect(f.size).toBe(frames[0].size);
  });

  it("scales with reach", () => {
    expect(explosion(5, 1)[2].size).toBeLessThan(explosion(12, 1)[2].size);
  });
});

describe("bounds", () => {
  it("finds the drawn area", () => {
    const g: Grid = { size: 4, px: new Uint8Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]) };
    expect(bounds(g)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
  });

  it("is null for an empty grid", () => {
    expect(bounds({ size: 3, px: new Uint8Array(9) })).toBeNull();
  });
});
