import { describe, expect, it } from "vitest";
import { layout, READOUT_WIDTH, readScale } from "./scale";

const SCREEN = { width: 256, height: 224 };
const CHROME = 100;

describe("readScale", () => {
  it("reads a whole scale and falls back to auto on anything else", () => {
    expect([readScale("3"), readScale(null), readScale(""), readScale("2.5"), readScale("0"), readScale("big")]).toEqual([
      3,
      "auto",
      "auto",
      "auto",
      "auto",
      "auto",
    ]);
  });
});

describe("layout", () => {
  it("fits the largest whole scale that leaves room for both readouts", () => {
    // 2560 wide leaves 7 screens across; 1300 high, 5 down — the height decides
    expect(layout("auto", { width: 2560, height: 1300 }, CHROME, SCREEN)).toEqual({ scale: 5, sideBySide: true });
    // the width decides
    const width = 3 * SCREEN.width + 2 * READOUT_WIDTH;
    expect(layout("auto", { width, height: 2000 }, CHROME, SCREEN)).toEqual({ scale: 3, sideBySide: true });
    expect(layout("auto", { width: width - 1, height: 2000 }, CHROME, SCREEN).scale).toBe(2);
  });

  it("never fits below one", () => {
    expect(layout("auto", { width: 300, height: 200 }, CHROME, SCREEN).scale).toBe(1);
  });

  it("keeps a picked scale and puts the readouts under the game when they no longer fit beside it", () => {
    expect(layout(4, { width: 1400, height: 800 }, CHROME, SCREEN)).toEqual({ scale: 4, sideBySide: false });
    expect(layout(2, { width: 1400, height: 800 }, CHROME, SCREEN)).toEqual({ scale: 2, sideBySide: true });
  });
});
