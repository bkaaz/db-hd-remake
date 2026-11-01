import { describe, expect, it } from "vitest";
import { MOTION_FRAMES, Motions, type Directions } from "./motion";

const NEUTRAL: Directions = { fwd: false, back: false, up: false, down: false };
const at = (...on: (keyof Directions)[]): Directions => ({
  ...NEUTRAL,
  ...Object.fromEntries(on.map((k) => [k, true])),
});

/** Feed a run of frames, oldest first. */
function play(...frames: Directions[]): Motions {
  const m = new Motions();
  for (const f of frames) m.push(f);
  return m;
}

describe("Motions.has", () => {
  it("is false with nothing in the history", () => {
    expect(new Motions().has("qcf")).toBe(false);
    expect(play(NEUTRAL, NEUTRAL).has("qcf")).toBe(false);
  });

  it("matches a rolled quarter circle, diagonal or not", () => {
    expect(play(at("down"), at("down", "fwd"), at("fwd")).has("qcf")).toBe(true);
    // The whole reason the diagonal is optional: this is what hands actually do.
    expect(play(at("down"), at("fwd")).has("qcf")).toBe(true);
  });

  it("takes a diagonal pressed from neutral as both its directions, so holding still works", () => {
    expect(play(NEUTRAL, at("down", "fwd")).has("qcf")).toBe(true);
    expect(play(at("down", "fwd"), at("down", "fwd")).has("qcf")).toBe(true);
  });

  it("counts a direction when it is pressed, so a held ↙ is not both orders", () => {
    // Final Flash's ↓ ↙ ← → and the Big Bang's ← ↙ ↓ ↘ →, each through a ↙ held two frames
    const finalFlash = play(NEUTRAL, at("down"), at("down", "back"), at("down", "back"), at("back"), at("fwd"));
    const bigBang = play(NEUTRAL, at("back"), at("down", "back"), at("down", "back"), at("down"), at("down", "fwd"), at("fwd"));
    expect([finalFlash.has("dbf"), finalFlash.has("hcf")]).toEqual([true, false]);
    expect([bigBang.has("hcf"), bigBang.has("dbf")]).toEqual([true, false]);
  });

  it("matches a half circle through the bottom, not a quarter circle", () => {
    expect(play(at("back"), at("down", "back"), at("down"), at("down", "fwd"), at("fwd")).has("hcf")).toBe(true);
    expect(play(at("down"), at("fwd")).has("hcf")).toBe(false);
  });

  it("matches down, back, then forward — not a half circle's order", () => {
    expect(play(at("down"), at("down", "back"), at("fwd")).has("dbf")).toBe(true);
    expect(play(at("back"), at("down"), at("fwd")).has("dbf")).toBe(false);
  });

  it("reads → ↓ ↘ as dp, and a quarter circle alone as not", () => {
    expect(play(at("fwd"), at("down"), at("down", "fwd")).has("dp")).toBe(true);
    expect(play(at("down"), at("down", "fwd"), at("fwd")).has("dp")).toBe(false);
  });

  it("reads → ↓ as fd, and ↓ → as not", () => {
    expect(play(at("fwd"), at("down")).has("fd")).toBe(true);
    expect(play(at("down"), at("fwd")).has("fd")).toBe(false);
  });

  it("reads ← ↓ ↙ as rdp, and ↓ ↙ ← (Abiseh Geri's) as not", () => {
    expect(play(at("back"), at("down"), at("down", "back")).has("rdp")).toBe(true);
    expect(play(at("down"), at("down", "back"), at("back")).has("rdp")).toBe(false);
  });

  it("does not match the directions in the wrong order", () => {
    expect(play(at("fwd"), at("down")).has("qcf")).toBe(false);
  });

  it("does not match back where forward is wanted", () => {
    expect(play(at("down"), at("back")).has("qcf")).toBe(false);
  });

  it("tolerates neutral frames in the middle", () => {
    expect(play(at("down"), NEUTRAL, NEUTRAL, at("fwd")).has("qcf")).toBe(true);
  });

  it("forgets a motion once it scrolls out of the window", () => {
    const m = play(at("down"), at("fwd"));
    expect(m.has("qcf")).toBe(true);
    for (let i = 0; i < MOTION_FRAMES; i++) m.push(NEUTRAL);
    expect(m.has("qcf")).toBe(false);
  });
});

describe("qcb is qcf's mirror, not a second implementation", () => {
  it("matches down then back", () => {
    expect(play(at("down"), at("down", "back"), at("back")).has("qcb")).toBe(true);
    expect(play(at("down"), at("back")).has("qcb")).toBe(true);
  });

  it("does not answer for its opposite", () => {
    // The one mistake a mirrored table invites, and the reason both are asserted:
    // `back` and `fwd` are already facing-relative, so nothing else flips them.
    expect(play(at("down"), at("fwd")).has("qcb")).toBe(false);
    expect(play(at("down"), at("back")).has("qcf")).toBe(false);
  });
});
