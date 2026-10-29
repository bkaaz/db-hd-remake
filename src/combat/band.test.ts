import { describe, expect, it } from "vitest";
import { bandHeights } from "./band";

const full = { from: [30, -51] as [number, number], size: 4, max: 9 };

describe("the beam's band", () => {
  it("opens from 2 px per unit of b1's size at the hands to 4 at the head", () => {
    expect(bandHeights(full, 0)).toEqual({ base: 8, head: 16 });
  });

  it("thickens by one unit every 8 frames", () => {
    expect(bandHeights(full, 7).head).toBe(16);
    expect(bandHeights(full, 8).head).toBe(20);
  });

  it("stops where the head lets it — 9 for a full charge, thinner than the base at the hands", () => {
    expect(bandHeights(full, 400)).toEqual({ base: 18, head: 36 });
  });

  it("stays flat for the small shot: as tall at the head as at the hands", () => {
    expect(bandHeights({ from: [30, -51], size: 2, max: 5, flat: true }, 0)).toEqual({ base: 4, head: 4 });
  });
});
