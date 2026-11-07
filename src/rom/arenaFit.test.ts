import { describe, expect, it } from "vitest";
import type { Rgba } from "../sprites/png";
import { fitArena, type FitLayer } from "./arenaFit";

const [WIDTH, HEIGHT] = [512, 224];
const SCREEN = 256;

/** Noise no two places of which agree, so that only one camera can explain it. */
function noise(seed: number, clearBelow = HEIGHT): Rgba {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  let v = seed;
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    v = (v * 1103515245 + 12345) & 0x7fffffff;
    const row = Math.floor(i / WIDTH);
    data.set([v & 0xf8, (v >> 8) & 0xf8, (v >> 16) & 0xf8, row < clearBelow ? 255 : 0], i * 4);
  }
  return { width: WIDTH, height: HEIGHT, data };
}

/** The screen those layers make from camera x, the arena `y` px lower. */
function shoot(layers: FitLayer[], x: number, y: number): Rgba {
  const data = new Uint8Array(SCREEN * HEIGHT * 4);
  for (let line = 0; line < HEIGHT; line++) {
    for (let column = 0; column < SCREEN; column++) {
      for (const { scroll: [speed, offset], image } of layers) {
        const row = line - y;
        if (row < 0 || row >= image.height) continue;
        const i = (row * WIDTH + (Math.floor(x * speed) + offset + column) % WIDTH) * 4;
        if (image.data[i + 3]) data.set(image.data.subarray(i, i + 4), (line * SCREEN + column) * 4);
      }
    }
  }
  return { width: SCREEN, height: HEIGHT, data };
}

// every camera tried over a whole screen: seconds, more than the default allows beside the other suites
describe("fitArena", { timeout: 30_000 }, () => {
  const layers: FitLayer[] = [
    { scroll: [0.25, 96], image: noise(1) },
    { scroll: [1, 0], image: noise(2, 100) },
  ];

  it("finds the camera of a screen those layers made", () => {
    expect(fitArena(layers, shoot(layers, 109, -1))).toEqual({ x: 109, y: -1, share: 1 });
  });

  it("reaches no full match when a layer scrolls at another speed", () => {
    const wrong: FitLayer[] = [{ scroll: [0.5, 64], image: layers[0].image }, layers[1]];
    expect(fitArena(wrong, shoot(layers, 200, 0)).share).toBeLessThan(0.9);
  });
});
