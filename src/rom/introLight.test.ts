import { describe, expect, it } from "vitest";
import { introBlue, withIntroLight } from "./introLight";

describe("introBlue", () => {
  // the background column of tools/re/runs/gotenks-intro.json's frame 645, in 5-bit blue
  it("follows the recorded gradient", () => {
    expect([129, 130, 142, 172, 175, 177, 199, 205, 220].map(introBlue)).toEqual([0, 1, 5, 15, 16, 17, 28, 31, 31]);
  });
});

describe("withIntroLight", () => {
  it("adds the row's blue to drawn pixels only", () => {
    // two pixels: grey 606058 at 58 rows above the feet (row 142, blue 5), and a transparent one
    const d = { image: { width: 1, height: 2, data: new Uint8Array([0x60, 0x60, 0x58, 255, 0, 0, 0, 0]) }, origin: { x: 0, y: 58 } };
    const lit = withIntroLight(d).image.data;
    expect([...lit.slice(0, 3)]).toEqual([0x60, 0x60, 0x58 + (5 << 3)]);
    expect([...lit.slice(4, 8)]).toEqual([0, 0, 0, 0]);
  });
});
