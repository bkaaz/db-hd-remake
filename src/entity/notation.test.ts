import { describe, expect, it } from "vitest";
import { isAmbiguous, readToken, type NotationData, type Reading } from "./notation";

const DATA: NotationData = {
  animations: {
    jab: { steps: [{ frame: "3" }, { frame: "4" }, { frame: "3" }] },
    high_kick: { steps: [{ frame: "8" }, { frame: "9" }] },
    high_kick_hold: { steps: [{ frame: "8" }, { frame: "9" }] },
  },
  states: {
    jab: { anim: "jab", type: "pop" },
    jab_air: { anim: "jab" },
  },
  types: { pop: { code: "po", onHit: "hurt", hitstun: 1, hitstop: 1, relaunch: false } },
};

const read = (token: string): Reading => {
  const r = readToken(token, DATA);
  if ("error" in r) throw new Error(r.error);
  return r;
};

describe("readToken", () => {
  it("reads the code as a hit type and the number as a frame", () => {
    expect(read("po4")).toMatchObject({ type: "pop", frame: "4" });
  });

  it("names every animation playing the frame, with the states playing it", () => {
    expect(read("po3").animations).toEqual([{ name: "jab", states: ["jab", "jab_air"] }]);
  });

  it("takes a bare frame, with no type", () => {
    expect(read("4").type).toBeUndefined();
  });

  it("refuses a code no type has, and says which exist", () => {
    const r = readToken("zz4", DATA);
    expect(r).toHaveProperty("error");
    expect("error" in r && r.error).toContain("po");
  });

  it("refuses what is not a code and a frame", () => {
    for (const bad of ["fl", "F30", "fl 30", "flx30"]) expect(readToken(bad, DATA)).toHaveProperty("error");
  });
});

describe("isAmbiguous", () => {
  it("is settled by one animation", () => {
    expect(isAmbiguous(read("po3"))).toBe(false);
  });

  it("asks when two animations play the frame", () => {
    expect(isAmbiguous(read("po9"))).toBe(true);
  });

  it("asks when nothing plays it", () => {
    expect(isAmbiguous(read("po5"))).toBe(true);
  });
});
