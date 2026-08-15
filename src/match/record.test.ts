import { describe, expect, it } from "vitest";
import type { EntityDebug } from "../entity/entity";
import { pressChanges } from "./record";

/**
 * Only the inference is tested, not the formatting. Whether a press was *spent*
 * or merely *expired* is a guess the recording makes from two snapshots, and a
 * wrong guess would send the reader hunting for a bug that is not there — which
 * is worse than saying nothing.
 */
const snapshot = (buffer: [string, number][]): EntityDebug => ({
  state: "idle",
  rank: 0,
  step: 0,
  steps: 1,
  framesLeft: 1,
  hitConfirmed: false,
  freeze: 0,
  stun: 0,
  hp: 100,
  vx: 0,
  buffer,
  combo: { hits: 0, damage: 0, lifts: 0 },
});

describe("pressChanges", () => {
  it("says nothing when the buffer did not change", () => {
    const same = snapshot([["medium", 5]]);
    expect(pressChanges("P1", same, same)).toEqual([]);
  });

  it("reports a press arriving", () => {
    expect(pressChanges("P1", snapshot([]), snapshot([["medium", 8]]))).toEqual(["P1 press medium"]);
  });

  it("calls it spent when it went with frames still on it", () => {
    // A transition fired on it — the normal, uninteresting case.
    expect(pressChanges("P1", snapshot([["medium", 5]]), snapshot([]))).toEqual([
      "P1 press medium spent",
    ]);
  });

  it("calls it expired when it went on its last frame", () => {
    // The interesting failure: the player asked and nothing was listening.
    expect(pressChanges("P1", snapshot([["medium", 1]]), snapshot([]))).toEqual([
      "P1 press medium EXPIRED unused",
    ]);
  });

  it("handles several buttons at once", () => {
    const was = snapshot([
      ["medium", 4],
      ["heavy", 1],
    ]);
    const now = snapshot([["light", 8]]);
    expect(pressChanges("P2", was, now)).toEqual([
      "P2 press light",
      "P2 press medium spent",
      "P2 press heavy EXPIRED unused",
    ]);
  });
});
