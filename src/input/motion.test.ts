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

  it("matches a held diagonal in two frames, so holding still works", () => {
    expect(play(at("down", "fwd")).has("qcf")).toBe(false);
    expect(play(at("down", "fwd"), at("down", "fwd")).has("qcf")).toBe(true);
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
