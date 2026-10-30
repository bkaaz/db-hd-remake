import { describe, expect, it } from "vitest";
import { healFrame, type HealDef } from "./heal";

/** Goku's charge ($0F:A020): every 2 frames, 13 steps a turn, +5 a turn. */
const GOKU: HealDef = { every: 2, turn: 13, gain: 5 };

/** Charge for `frames`, from the dial at `dial`: where it ends and what it gave. */
function charge(frames: number, dial = 0): { dial: number; gained: number } {
  let gained = 0;
  for (let clock = 0; clock < frames; clock++) {
    const r = healFrame(dial, clock, GOKU);
    dial = r.dial;
    gained += r.gain;
  }
  return { dial, gained };
}

describe("charging", () => {
  it("steps the dial every other frame", () => {
    expect(charge(1)).toEqual({ dial: 1, gained: 0 });
    expect(charge(2)).toEqual({ dial: 1, gained: 0 });
    expect(charge(3)).toEqual({ dial: 2, gained: 0 });
  });

  it("gives 5 health for each full turn, 26 frames, and starts the dial again", () => {
    expect(charge(25)).toEqual({ dial: 0, gained: 5 });
    expect(charge(26)).toEqual({ dial: 0, gained: 5 });
    expect(charge(52)).toEqual({ dial: 0, gained: 10 });
  });

  it("carries on from wherever an earlier charge left the dial", () => {
    expect(charge(1, 12)).toEqual({ dial: 0, gained: 5 });
  });
});
