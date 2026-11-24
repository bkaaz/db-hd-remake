import { describe, expect, it } from "vitest";
import { PAD, PadHistory } from "./command";
import { DoubleTap } from "./doubleTap";

/** Plays a pad of [direction or null, frames] runs: the frames the dash was pressed on, and those it was held on. */
function play(runs: [number | null, number][]): { pressed: number[]; held: number } {
  const history = new PadHistory();
  const tap = new DoubleTap();
  const pressed: number[] = [];
  let held = 0;
  let frame = 0;
  for (const [dir, frames] of runs) {
    for (let i = 0; i < frames; i++, frame++) {
      history.record({ pressed: 0, held: dir ?? 0 });
      const now = tap.step(history);
      if (now.pressed) pressed.push(frame);
      if (now.held) held++;
    }
  }
  return { pressed, held };
}

describe("DoubleTap", () => {
  it("presses the dash on the second tap and holds it while the direction is held", () => {
    expect(play([[null, 10], [PAD.fwd, 2], [null, 3], [PAD.fwd, 8], [null, 5]])).toEqual({ pressed: [15], held: 8 });
  });

  it("takes the taps up to 12 frames apart, not 13", () => {
    expect(play([[null, 10], [PAD.fwd, 2], [null, 10], [PAD.fwd, 4]]).pressed).toEqual([22]);
    expect(play([[null, 10], [PAD.fwd, 2], [null, 11], [PAD.fwd, 4]]).pressed).toEqual([]);
  });

  it("does not dash on a walk, nor on taps of two directions", () => {
    expect(play([[null, 10], [PAD.fwd, 40]]).pressed).toEqual([]);
    expect(play([[null, 10], [PAD.fwd, 2], [null, 3], [PAD.back, 8]]).pressed).toEqual([]);
  });

  it("dashes back the same way", () => {
    expect(play([[null, 10], [PAD.back, 2], [null, 3], [PAD.back, 8]]).pressed).toEqual([15]);
  });
});
