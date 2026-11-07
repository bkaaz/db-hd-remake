/**
 * A picture whose palettes step by themselves: the arena's fire, clouds and
 * lightning, none of which the fight has any say in. Pure, on plain bytes, so
 * Node can test it; `arena/cycledLayer.ts` is what shows it (ADR 0081).
 */

import type { PaletteCycle } from "./arenaFile";

/** RGBA bytes, as a canvas and `decodePng` both hold them. */
type Bytes = Uint8Array | Uint8ClampedArray;

const COLOURS = 16;

/** Frames a cycle stands on a step. */
const held = ({ hold }: PaletteCycle, step: number) => (typeof hold === "number" ? hold : hold[step]);

/** One cycle's place in the picture and in time. */
class Clock {
  /** Byte offsets of the picture's pixels in this palette, and each one's colour in it. */
  readonly pixels: number[] = [];
  readonly colours: number[] = [];
  private step: number;
  private left: number;

  constructor(
    readonly cycle: PaletteCycle,
    private readonly steps: Bytes,
  ) {
    this.step = cycle.start;
    this.left = held(cycle, this.step);
  }

  /** A frame gone by: whether it stepped. */
  tick(): boolean {
    if (--this.left > 0) return false;
    this.step = (this.step + 1) % this.cycle.steps;
    this.left = held(this.cycle, this.step);
    return true;
  }

  paint(picture: Bytes): void {
    const row = this.step * COLOURS * 4;
    this.pixels.forEach((at, i) => {
      const from = row + this.colours[i] * 4;
      picture[at] = this.steps[from];
      picture[at + 1] = this.steps[from + 1];
      picture[at + 2] = this.steps[from + 2];
    });
  }
}

export class CycledPicture {
  private readonly clocks: Clock[];

  /**
   * @param picture what is on screen, repainted in place
   * @param numbers the same size: each pixel's colour number in red, its alpha 0 where clear
   * @param cycles each palette, with its steps: `COLOURS` a row, a row per step
   */
  constructor(
    private readonly picture: Bytes,
    numbers: Bytes,
    cycles: { cycle: PaletteCycle; steps: Bytes }[],
  ) {
    this.clocks = cycles.map(({ cycle, steps }) => new Clock(cycle, steps));
    for (let at = 0; at < numbers.length; at += 4) {
      if (!numbers[at + 3]) continue;
      const clock = this.clocks.find((c) => c.cycle.palette === numbers[at] >> 4);
      if (!clock) continue;
      clock.pixels.push(at);
      clock.colours.push(numbers[at] & (COLOURS - 1));
    }
  }

  /** One game frame: whether the picture changed, and so has to be shown again. */
  tick(): boolean {
    let changed = false;
    for (const clock of this.clocks) {
      if (!clock.tick()) continue;
      clock.paint(this.picture);
      changed = true;
    }
    return changed;
  }
}
