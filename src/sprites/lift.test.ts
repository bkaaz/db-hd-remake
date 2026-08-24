import { describe, expect, it } from "vitest";
import { liftFrames } from "./lift";
import type { Rgba } from "./png";

/** A sheet whose every pixel encodes its own coordinates, so a copy is checkable. */
function coded(width: number, height: number): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function pixel(img: Rgba, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

describe("liftFrames", () => {
  const src = coded(64, 32);
  const rects = [
    { x: 10, y: 4, w: 6, h: 5 },
    { x: 40, y: 12, w: 3, h: 8 },
  ];

  it("copies each rect's pixels to where the new frame says they are", () => {
    const { sheet, frames } = liftFrames(src, rects);
    rects.forEach((r, i) => {
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          expect(pixel(sheet, frames[i].x + x, frames[i].y + y)).toEqual([
            r.x + x,
            r.y + y,
            0,
            255,
          ]);
        }
      }
    });
  });

  it("leaves a gap, so no frame bleeds into its neighbour", () => {
    const { sheet, frames } = liftFrames(src, rects);
    expect(frames[1].x).toBeGreaterThan(frames[0].x + frames[0].w);
    for (let y = 0; y < sheet.height; y++) {
      expect(pixel(sheet, frames[0].x + frames[0].w, y)[3]).toBe(0);
    }
  });

  it("keeps every frame inside the sheet it wrote", () => {
    const { sheet, frames } = liftFrames(src, rects);
    for (const f of frames) {
      expect(f.x + f.w).toBeLessThanOrEqual(sheet.width);
      expect(f.y + f.h).toBeLessThanOrEqual(sheet.height);
    }
  });

  it("anchors a frame at its own centre, not at its foot", () => {
    const { frames } = liftFrames(src, [{ x: 0, y: 0, w: 7, h: 5 }]);
    expect(frames[0].anchor).toEqual([3, 2]);
  });

  it("anchors on the rear edge for something emitted from a point", () => {
    // The muzzle, so the drawing starts where it leaves the hand and grows
    // forward — centred, half of a bolt sits inside the fighter who threw it.
    const { frames } = liftFrames(src, [{ x: 0, y: 0, w: 7, h: 5 }], { anchor: "back" });
    expect(frames[0].anchor).toEqual([0, 2]);
  });

  it("anchors on the trailing corner for something emitted diagonally", () => {
    const { frames } = liftFrames(src, [{ x: 0, y: 0, w: 7, h: 5 }], { anchor: "back-bottom" });
    expect(frames[0].anchor).toEqual([0, 4]);
  });

  it("lets one frame choose its own anchor, since one bolt has two flights", () => {
    const { frames } = liftFrames(
      src,
      [
        { x: 0, y: 0, w: 7, h: 5 },
        { x: 0, y: 0, w: 7, h: 5, anchor: "back-bottom" },
      ],
      { anchor: "back" },
    );
    expect(frames[0].anchor).toEqual([0, 2]);
    expect(frames[1].anchor).toEqual([0, 4]);
  });

  it("refuses a rect that leaves the source sheet", () => {
    expect(() => liftFrames(src, [{ x: 60, y: 0, w: 8, h: 4 }])).toThrow(/outside/);
  });

  it("refuses nothing to do", () => {
    expect(() => liftFrames(src, [])).toThrow();
  });
});
