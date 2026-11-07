import { describe, expect, it } from "vitest";
import { PAD, PadHistory } from "./command";
import { hopAsked } from "./hop";

/** Plays a pad of [direction or null, frames] runs, and says on which frames a hop was asked — true until the first tap leaves the window; the state it starts is entered on the first. */
function play(runs: [number | null, number][]): { frame: number; way: string }[] {
  const history = new PadHistory();
  const asked: { frame: number; way: string }[] = [];
  let frame = 0;
  for (const [held, frames] of runs) {
    for (let i = 0; i < frames; i++, frame++) {
      history.record({ pressed: 0, held: held ?? 0 });
      const way = hopAsked(history);
      if (way) asked.push({ frame, way });
    }
  }
  return asked;
}

// Measured in the original, tools/re/runs/double-tap.json (2026-11-07)
describe("hopAsked", () => {
  it("hops once the second tap has been held for its sixth frame", () => {
    expect(play([[null, 10], [PAD.fwd, 2], [null, 3], [PAD.fwd, 12]])[0]).toEqual({ frame: 20, way: "fwd" });
  });

  it("hops with the taps 9 frames apart, not 10", () => {
    expect(play([[null, 10], [PAD.fwd, 2], [null, 9], [PAD.fwd, 12]])).toHaveLength(1);
    expect(play([[null, 10], [PAD.fwd, 2], [null, 10], [PAD.fwd, 12]])).toEqual([]);
  });

  it("takes a first tap held for a while", () => {
    expect(play([[null, 10], [PAD.fwd, 5], [null, 4], [PAD.fwd, 12]])[0]?.frame).toBe(24);
  });

  it("does not hop on a walk, nor on two taps let go", () => {
    expect(play([[null, 10], [PAD.fwd, 40]])).toEqual([]);
    expect(play([[null, 10], [PAD.fwd, 2], [null, 3], [PAD.fwd, 3], [null, 20]])).toEqual([]);
  });

  it("hops backward the same way", () => {
    expect(play([[null, 10], [PAD.back, 2], [null, 3], [PAD.back, 12]])[0]).toEqual({ frame: 20, way: "back" });
  });
});
