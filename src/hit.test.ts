import { describe, expect, it } from "vitest";
import { boxToWorld, contact, impactPoint, intersection, overlaps, type Placement } from "./hit";

/** Did the blow land at all? The engine wants the point, so it asks `contact`. */
const connects = (
  attacker: Parameters<typeof contact>[0],
  defender: Parameters<typeof contact>[1],
): boolean => contact(attacker, defender) !== null;

/** Standing at x=100 on the ground line y=200, facing right, drawn at 1:1. */
const RIGHT: Placement = { x: 100, y: 200, facing: 1, scale: 1 };
const LEFT: Placement = { ...RIGHT, facing: -1 };

describe("boxToWorld", () => {
  it("places a box relative to the anchor when facing right", () => {
    // A box 20px in front, 60px above the ground.
    expect(boxToWorld({ x: 20, y: -60, w: 30, h: 20 }, RIGHT)).toEqual({
      x: 120,
      y: 140,
      w: 30,
      h: 20,
    });
  });

  it("mirrors X around the anchor when facing left", () => {
    // The same box must now reach 20px to the LEFT of the anchor.
    expect(boxToWorld({ x: 20, y: -60, w: 30, h: 20 }, LEFT)).toEqual({
      x: 50, // 100 - (20 + 30)
      y: 140,
      w: 30,
      h: 20,
    });
  });

  it("keeps a box centred on the anchor centred after mirroring", () => {
    const body = { x: -10, y: -50, w: 20, h: 50 };
    expect(boxToWorld(body, LEFT)).toEqual(boxToWorld(body, RIGHT));
  });

  it("scales the rectangle and its offset together", () => {
    expect(boxToWorld({ x: 20, y: -60, w: 30, h: 20 }, { ...RIGHT, scale: 3 })).toEqual({
      x: 160, // 100 + 20*3
      y: 20, //  200 - 60*3
      w: 90,
      h: 60,
    });
  });
});

describe("overlaps", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };

  it("detects an overlap", () => {
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it("rejects a gap", () => {
    expect(overlaps(a, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it("does not count touching edges", () => {
    expect(overlaps(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it("requires both axes to overlap", () => {
    // Horizontally aligned but far above.
    expect(overlaps(a, { x: 5, y: -100, w: 10, h: 10 })).toBe(false);
  });
});

describe("connects", () => {
  /** A fist reaching 20–50px in front, at chest height. */
  const fist = [{ x: 20, y: -70, w: 30, h: 20 }];
  /** A body box around the anchor. */
  const body = [{ x: -12, y: -90, w: 24, h: 90 }];

  it("connects when the attacker is in range and facing the defender", () => {
    expect(
      connects(
        { boxes: fist, at: RIGHT },
        { boxes: body, at: { ...RIGHT, x: 140 } }, // 40px in front
      ),
    ).toBe(true);
  });

  it("misses when the defender is out of reach", () => {
    expect(
      connects({ boxes: fist, at: RIGHT }, { boxes: body, at: { ...RIGHT, x: 300 } }),
    ).toBe(false);
  });

  it("misses when the attacker faces away", () => {
    // Same distance as the connecting case, but punching the other way.
    expect(
      connects({ boxes: fist, at: LEFT }, { boxes: body, at: { ...RIGHT, x: 140 } }),
    ).toBe(false);
  });

  it("connects to the left when facing left", () => {
    expect(
      connects({ boxes: fist, at: LEFT }, { boxes: body, at: { ...LEFT, x: 60 } }),
    ).toBe(true);
  });

  it("misses when the boxes pass at different heights", () => {
    const lowSweep = [{ x: 20, y: -10, w: 30, h: 10 }];
    const floatingTarget = [{ x: -12, y: -90, w: 24, h: 40 }];
    expect(
      connects({ boxes: lowSweep, at: RIGHT }, { boxes: floatingTarget, at: { ...RIGHT, x: 140 } }),
    ).toBe(false);
  });

  it("is false when either side has no boxes", () => {
    const target = { boxes: body, at: { ...RIGHT, x: 140 } };
    expect(connects({ boxes: [], at: RIGHT }, target)).toBe(false);
    expect(connects({ boxes: fist, at: RIGHT }, { boxes: [], at: target.at })).toBe(false);
  });

  it("takes the render scale into account", () => {
    // At 1:1 a target 200px away is far out of reach; at 3x the same authored
    // reach covers it.
    const far = { boxes: body, at: { ...RIGHT, x: 220, scale: 3 } };
    expect(connects({ boxes: fist, at: RIGHT }, { boxes: body, at: { ...RIGHT, x: 220 } })).toBe(
      false,
    );
    expect(connects({ boxes: fist, at: { ...RIGHT, scale: 3 } }, far)).toBe(true);
  });
});

describe("intersection", () => {
  it("is the rectangle the two share", () => {
    expect(intersection({ x: 0, y: 0, w: 10, h: 10 }, { x: 6, y: 4, w: 10, h: 10 })).toEqual({
      x: 6,
      y: 4,
      w: 4,
      h: 6,
    });
  });

  it("is the smaller box when one contains the other", () => {
    const inner = { x: 3, y: 3, w: 2, h: 2 };
    expect(intersection({ x: 0, y: 0, w: 10, h: 10 }, inner)).toEqual(inner);
  });
});

describe("contact", () => {
  /** A fist reaching 20-50px in front, at chest height. */
  const fist = [{ x: 20, y: -70, w: 30, h: 20 }];
  /** A body box around the anchor. */
  const body = [{ x: -12, y: -90, w: 24, h: 90 }];

  it("reports where the boxes actually met, not where either fighter stands", () => {
    // Attacker at x=100 facing right, defender's anchor at 140. The fist spans
    // 120..150 in the world, the body 128..152, so they share 128..150. Y is
    // measured down from the ground line at 200, so the fist's -70 sits at 130.
    const where = contact({ boxes: fist, at: RIGHT }, { boxes: body, at: { ...RIGHT, x: 140 } });
    expect(where).toEqual({ x: 128, y: 130, w: 22, h: 20 });
  });

  it("is null when nothing reaches", () => {
    expect(contact({ boxes: fist, at: RIGHT }, { boxes: body, at: { ...RIGHT, x: 300 } })).toBeNull();
  });

});

describe("impactPoint", () => {
  const overlap = { x: 100, y: 50, w: 20, h: 10 };

  it("sits at the far edge of the overlap, the deepest the blow reached", () => {
    // Punching right, the impact is at the leading edge — not at 110, the
    // middle, which for a narrow fist box lands back on the attacker's arm.
    expect(impactPoint(overlap, 1)).toEqual({ x: 120, y: 55 });
  });

  it("mirrors when the blow travels the other way", () => {
    expect(impactPoint(overlap, -1)).toEqual({ x: 100, y: 55 });
  });

  it("takes its height from the middle of the overlap", () => {
    expect(impactPoint({ x: 0, y: 0, w: 4, h: 100 }, 1).y).toBe(50);
  });
});
