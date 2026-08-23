import { describe, expect, it } from "vitest";
import { alignedAnchorY, centreOfMass } from "./anchors";
import type { FrameDef } from "../entity/entityFile";

/**
 * A frame `w × h` with a solid block of body from row `top` to row `bottom`,
 * anchored at the bottom edge the way auto-detection leaves it.
 */
function block(w: number, h: number, top: number, bottom: number): { frame: FrameDef; mask: Uint8Array } {
  const mask = new Uint8Array(w * h);
  for (let y = top; y <= bottom; y++) for (let x = 0; x < w; x++) mask[y * w + x] = 1;
  return { frame: { x: 0, y: 0, w, h, anchor: [w >> 1, h] }, mask };
}

describe("centreOfMass", () => {
  it("is the middle row of a solid block", () => {
    const { frame, mask } = block(4, 10, 2, 6);
    expect(centreOfMass(mask, frame)).toBe(4);
  });

  it("is null when nothing is drawn", () => {
    const frame: FrameDef = { x: 0, y: 0, w: 4, h: 4, anchor: [2, 4] };
    expect(centreOfMass(new Uint8Array(16), frame)).toBeNull();
  });

  it("is pulled by where the pixels are, not by the rectangle", () => {
    // The whole point: a thrown leg makes the rectangle taller without moving
    // the body, and the rectangle is what the old anchor followed.
    const { frame, mask } = block(4, 20, 14, 18);
    expect(centreOfMass(mask, frame)).toBe(16);
  });
});

describe("alignedAnchorY", () => {
  it("puts the body at one height across frames of different rectangles", () => {
    // Three frames whose bodies sit at the same place but whose rectangles are
    // cut to 10, 20 and 12 rows — the shape of the hop_lunge defect.
    const frames = [block(4, 10, 4, 8), block(4, 20, 14, 18), block(4, 12, 6, 10)];
    const anchors = alignedAnchorY(frames);
    const bodyToAnchor = frames.map((f, i) => anchors[i] - (centreOfMass(f.mask, f.frame) as number));
    expect(new Set(bodyToAnchor).size).toBe(1);
  });

  it("leaves the run where it already sat", () => {
    // It removes the jitter; it does not lift or drop the move. A single frame
    // aligned with itself must come back unchanged.
    const one = [block(4, 10, 4, 8)];
    expect(alignedAnchorY(one)).toEqual([one[0].frame.anchor[1]]);
  });

  it("does not let one badly cut frame drag the others", () => {
    // The median is doing this. Two frames agree, a third is cut 30 rows tall
    // around the same body; the two must keep their offset.
    const good = [block(4, 10, 4, 8), block(4, 10, 4, 8)];
    const odd = block(4, 40, 4, 8);
    const anchors = alignedAnchorY([...good, odd]);
    expect(anchors[0]).toBe(good[0].frame.anchor[1]);
    expect(anchors[1]).toBe(good[1].frame.anchor[1]);
  });

  it("keeps the anchor of a frame with nothing drawn on it", () => {
    const empty = { frame: { x: 0, y: 0, w: 4, h: 7, anchor: [2, 7] } as FrameDef, mask: new Uint8Array(28) };
    expect(alignedAnchorY([block(4, 10, 4, 8), empty])[1]).toBe(7);
  });
});
