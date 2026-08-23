import { describe, expect, it } from "vitest";
import { HISTORY_ENTRIES, InputHistory } from "./history";
import type { Directions } from "./motion";

const NEUTRAL: Directions = { fwd: false, back: false, up: false, down: false };
const at = (...on: (keyof Directions)[]): Directions => ({
  ...NEUTRAL,
  ...Object.fromEntries(on.map((k) => [k, true])),
});

describe("InputHistory", () => {
  it("is empty until something happens", () => {
    const h = new InputHistory();
    h.record(NEUTRAL, [], []);
    h.record(NEUTRAL, [], []);
    expect(h.line).toBe("");
  });

  it("writes one entry per change, not per frame", () => {
    // The rule the whole thing hangs on: holding a direction for twenty frames
    // is one input, and a line that says so twenty times cannot be read.
    const h = new InputHistory();
    for (let i = 0; i < 20; i++) h.record(at("fwd"), [], []);
    expect(h.line).toBe("→");
  });

  it("records a button even when the direction has not moved", () => {
    const h = new InputHistory();
    h.record(at("fwd"), [], []);
    h.record(at("fwd"), ["M"], []);
    expect(h.line).toBe("→ →M");
  });

  it("draws the diagonals", () => {
    const h = new InputHistory();
    h.record(at("down"), [], []);
    h.record(at("down", "fwd"), [], []);
    h.record(at("fwd"), ["M"], []);
    expect(h.line).toBe("↓ ↘ →M");
  });

  it("marks where a motion completed, which is the question it exists to answer", () => {
    const h = new InputHistory();
    h.record(at("down"), [], []);
    h.record(at("fwd"), ["M"], ["qcf"]);
    expect(h.line).toBe("↓ →M·qcf");
  });

  it("drops the oldest entry once the line is full", () => {
    const h = new InputHistory();
    for (let i = 0; i < HISTORY_ENTRIES + 3; i++) {
      h.record(i % 2 === 0 ? at("fwd") : at("back"), [], []);
    }
    expect(h.line.split(" ")).toHaveLength(HISTORY_ENTRIES);
  });

  it("returning to neutral is itself a change worth seeing", () => {
    // Otherwise a release is invisible, and "I let go of down too early" — the
    // exact mistake a motion input punishes — cannot be read off the line.
    const h = new InputHistory();
    h.record(at("down"), [], []);
    h.record(NEUTRAL, [], []);
    expect(h.line).toBe("↓ ·");
  });
});
