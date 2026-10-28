import { describe, expect, it } from "vitest";
import { PLAIN, frameId, parseFrameId, placeBoxes } from "./look";

describe("frameId", () => {
  it("is the bare drawing when it is shown as drawn", () => {
    expect(frameId(11, PLAIN)).toBe("11");
  });

  it("names the flip and the offset, and reads back to the same look", () => {
    const look = { h: true, v: true, dx: 0, dy: -48 };
    expect(frameId(11, look)).toBe("11_hv_0,-48");
    expect(parseFrameId("11_hv_0,-48")).toEqual({ drawing: 11, look });
    expect(parseFrameId("12_v")).toEqual({ drawing: 12, look: { h: false, v: true, dx: 0, dy: 0 } });
  });

  it("refuses an id the exporter did not write", () => {
    expect(() => parseFrameId("idle")).toThrow(/not a frame/);
  });
});

describe("placeBoxes", () => {
  const box = { type: "hit" as const, x: 2, y: -10, w: 6, h: 4 };

  it("mirrors a box about the origin, then moves it by the offset", () => {
    expect(placeBoxes([box], { h: true, v: false, dx: 0, dy: 0 })[0]).toMatchObject({ x: -8, y: -10 });
    expect(placeBoxes([box], { h: false, v: true, dx: 0, dy: 0 })[0]).toMatchObject({ x: 2, y: 6 });
    expect(placeBoxes([box], { h: false, v: false, dx: 5, dy: -48 })[0]).toMatchObject({ x: 7, y: -58 });
  });
});
