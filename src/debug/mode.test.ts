import { describe, expect, it } from "vitest";
import { modeAt, NO_MODE } from "./mode";

const file = {
  modes: [{}, { p1: { at: 0.8 }, p2: { at: 0.97 }, boxes: true }],
};

describe("modeAt", () => {
  it("hands back the mode that was asked for", () => {
    expect(modeAt(file, 1)).toEqual({ p1: { at: 0.8 }, p2: { at: 0.97 }, boxes: true });
  });

  it("lets a mode say nothing at all", () => {
    // A mode is a list of differences, so an empty one is the scene as it is.
    expect(modeAt(file, 0)).toEqual(NO_MODE);
  });

  it("says so when the number is not in the file", () => {
    expect(modeAt(file, 5)).toBe("no mode 5 — data/debug.json holds 2");
  });

  it("refuses something that is not a mode number", () => {
    expect(modeAt(file, 1.5)).toContain("not a mode number");
    expect(modeAt(file, -1)).toContain("not a mode number");
  });

  it("runs the scene as it is when there is no file, but only for mode 0", () => {
    // Missing file with nothing asked for is not a mistake; missing file with
    // mode=3 is, and quietly running mode 0 would send you debugging the wrong
    // setup.
    expect(modeAt(null, 0)).toEqual(NO_MODE);
    expect(modeAt(null, 3)).toContain("no modes");
  });

  it("catches a placement outside the stage", () => {
    // The failure it prevents is silent: the first resize clamps a fighter back
    // inside, so 9.5 would look like the mode having done nothing.
    expect(modeAt({ modes: [{ p2: { at: 9.5 } }] }, 0)).toContain("between 0 and 1");
    expect(modeAt({ modes: [{ p1: { at: -0.2 } }] }, 0)).toContain("between 0 and 1");
  });

  it("takes both fighters at the same place — that is how a corner is written", () => {
    const both = { modes: [{ p1: { at: 0.95 }, p2: { at: 0.95 } }] };
    expect(modeAt(both, 0)).toEqual(both.modes[0]);
  });
});
