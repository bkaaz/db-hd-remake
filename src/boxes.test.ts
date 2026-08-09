import { describe, expect, it } from "vitest";
import { activeIndex, durations, hitBox, hurtBox, reach, type FrameRect } from "./boxes";

/** A 32x58 sprite, anchor between the feet. */
const rest: FrameRect = { x: 0, y: 0, w: 32, h: 58, anchor: [16, 58] };
/** The same fighter with an arm extended forward: wider, anchor stays put. */
const extended: FrameRect = { x: 0, y: 0, w: 48, h: 58, anchor: [16, 58] };

describe("hurtBox", () => {
  it("covers the silhouette, measured from the anchor", () => {
    expect(hurtBox(rest)).toEqual({ type: "hurt", x: -16, y: -58, w: 32, h: 58 });
  });

  it("shrinks on every side when inset", () => {
    expect(hurtBox(rest, 2)).toEqual({ type: "hurt", x: -14, y: -56, w: 28, h: 54 });
  });

  it("refuses to produce an inside-out box", () => {
    expect(hurtBox({ x: 0, y: 0, w: 4, h: 4, anchor: [2, 4] }, 3)).toBeNull();
  });

  it("follows an off-centre anchor", () => {
    const leaning: FrameRect = { x: 0, y: 0, w: 32, h: 58, anchor: [8, 58] };
    expect(hurtBox(leaning)).toEqual({ type: "hurt", x: -8, y: -58, w: 32, h: 58 });
  });
});

describe("activeIndex", () => {
  it("picks the frame reaching furthest in front of the anchor", () => {
    expect(activeIndex([rest, extended, rest])).toBe(1);
  });

  it("prefers the earliest frame on a tie", () => {
    expect(activeIndex([rest, rest])).toBe(0);
  });

  it("measures reach in front of the anchor, not raw width", () => {
    // Wider overall, but all the extra width is *behind* the anchor.
    const trailing: FrameRect = { x: 0, y: 0, w: 60, h: 58, anchor: [44, 58] };
    expect(reach(trailing)).toBe(16);
    expect(activeIndex([trailing, extended])).toBe(1);
  });
});

describe("hitBox", () => {
  it("covers the part that sticks out beyond the resting pose", () => {
    const { box, from } = hitBox([rest, extended, rest], 1);
    expect(from).toBe("extension");
    // rest reaches 16px in front; extended reaches 32 — so 16px of arm.
    expect(box.x).toBe(16);
    expect(box.w).toBe(16);
    expect(box.type).toBe("hit");
  });

  it("sits at chest height, not at the feet", () => {
    const { box } = hitBox([rest, extended], 1);
    expect(box.y).toBeLessThan(-Math.round(58 * 0.5));
    expect(box.y + box.h).toBeLessThan(0);
  });

  it("falls back to a box in front when nothing measurably extends", () => {
    const { box, from } = hitBox([rest], 0);
    expect(from).toBe("fallback");
    expect(box.w).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
  });
});

describe("durations", () => {
  it("makes an attack sharp: wind-up long, active short, recovery longest", () => {
    // 4 frames, the third one active.
    expect(durations("attack", 4, 2)).toEqual([4, 4, 2, 5]);
  });

  it("keeps looping animations even", () => {
    expect(durations("loop", 3, 0)).toEqual([6, 6, 6]);
  });

  it("spreads a hit reaction over roughly 12 frames", () => {
    expect(durations("hurt", 2, 0)).toEqual([6, 6]);
    expect(durations("hurt", 3, 0)).toEqual([4, 4, 4]);
  });

  it("honours an explicit override on every step", () => {
    expect(durations("attack", 3, 1, 7)).toEqual([7, 7, 7]);
  });

  it("never produces a zero-length step", () => {
    expect(durations("loop", 2, 0, 0)).toEqual([1, 1]);
    expect(durations("hurt", 30, 0).every((d) => d >= 1)).toBe(true);
  });
});
