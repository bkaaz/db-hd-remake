import { describe, expect, it } from "vitest";
import { Boost, BOOST_FRAMES } from "./boost";

const boost = (frames: number) => new Boost({ hold: "blast", frames, bar: 10, needs: 10 });

describe("Boost", () => {
  it("plays the whole charge in the boost's frames, however long it is by hand", () => {
    for (const frames of [18, 32, 44, 60]) {
      const b = boost(frames);
      const played = [...Array(BOOST_FRAMES)].reduce((n: number) => n + b.take(), 0);
      expect(played).toBe(frames);
    }
  });

  it("spreads the frames evenly, never more than one apart", () => {
    const b = boost(44);
    const steps = [...Array(BOOST_FRAMES)].map(() => b.take());
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1);
  });
});
