import { describe, expect, it } from "vitest";
import type { EntityDebug } from "../entity/entity";
import { motionChanges, pressChanges } from "./record";

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
  ki: 0,
  inputs: "",
  motions: [],
  combo: { hits: 0, damage: 0, lifts: 0 },
});

describe("pressChanges", () => {
  it("says nothing when the buffer did not change", () => {
    const same = snapshot([["blast", 5]]);
    expect(pressChanges("P1", same, same)).toEqual([]);
  });

  it("reports a press arriving", () => {
    expect(pressChanges("P1", snapshot([]), snapshot([["blast", 8]]))).toEqual(["P1 press blast"]);
  });

  it("calls it spent when it went with frames still on it", () => {
    // A transition fired on it — the normal, uninteresting case.
    expect(pressChanges("P1", snapshot([["blast", 5]]), snapshot([]))).toEqual([
      "P1 press blast spent",
    ]);
  });

  it("calls it expired when it went on its last frame", () => {
    // The interesting failure: the player asked and nothing was listening.
    expect(pressChanges("P1", snapshot([["blast", 1]]), snapshot([]))).toEqual([
      "P1 press blast EXPIRED unused",
    ]);
  });

  it("handles several buttons at once", () => {
    const was = snapshot([
      ["blast", 4],
      ["smash", 1],
    ]);
    const now = snapshot([["attack", 8]]);
    expect(pressChanges("P2", was, now)).toEqual([
      "P2 press attack",
      "P2 press blast spent",
      "P2 press smash EXPIRED unused",
    ]);
  });
});

describe("motionChanges", () => {
  const withMotions = (motions: string[]) => ({ ...snapshot([]), motions });

  it("says so the frame a motion completes", () => {
    expect(motionChanges("P1", withMotions([]), withMotions(["qcf"]))).toEqual(["P1 motion qcf"]);
  });

  it("says nothing while it stays complete", () => {
    // It holds for its whole window; a line a frame would be fourteen lines
    // saying one thing, which is how a log stops being read.
    expect(motionChanges("P1", withMotions(["qcf"]), withMotions(["qcf"]))).toEqual([]);
  });

  it("says nothing when it falls out of the window", () => {
    expect(motionChanges("P1", withMotions(["qcf"]), withMotions([]))).toEqual([]);
  });
});
