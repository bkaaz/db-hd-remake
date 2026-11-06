import { describe, expect, it } from "vitest";
import { pillarAt, type PillarDef } from "./pillar";

const sinking: PillarDef = { ahead: 38, ends: "sinking" };
const narrowing: PillarDef = { ahead: 38, ends: "narrowing", flickers: true };

/** The frames on which it draws anything. */
const litFrames = (def: PillarDef, upTo: number) =>
  Array.from({ length: upTo }, (_, t) => t).filter((t) => {
    const shape = pillarAt(def, t);
    return shape && shape.half > 0 && shape.height > 0;
  });

describe("pillarAt", () => {
  it("rises 16 px and widens 1 px a frame, up to 0xF0 and 16", () => {
    expect(pillarAt(sinking, 1)).toEqual({ half: 1, height: 16 });
    expect(pillarAt(sinking, 15)).toEqual({ half: 15, height: 0xf0 });
    expect(pillarAt(sinking, 16)).toEqual({ half: 16, height: 0xf0 });
  });

  it("sinks 16 px a frame and is gone on the 32nd frame, when the next may start", () => {
    expect(pillarAt(sinking, 17)).toEqual({ half: 16, height: 0xe0 });
    expect(pillarAt(sinking, 30)).toEqual({ half: 16, height: 16 });
    expect(pillarAt(sinking, 31)).toBeNull();
  });

  it("narrows a pixel a side at its full height and is gone at 32", () => {
    expect(pillarAt({ ...narrowing, flickers: false }, 17)).toEqual({ half: 15, height: 0xf0 });
    expect(pillarAt({ ...narrowing, flickers: false }, 31)).toEqual({ half: 1, height: 0xf0 });
    expect(pillarAt({ ...narrowing, flickers: false }, 32)).toBeNull();
  });

  it("flickers every other frame only if it says so", () => {
    expect(litFrames(narrowing, 8)).toEqual([1, 3, 5, 7]);
    expect(litFrames(sinking, 8)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
