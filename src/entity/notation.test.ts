import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HIT_TYPES } from "../combat/hitTypes";
import { isAmbiguous, readToken, type NotationData, type Reading } from "./notation";

const DATA: NotationData = {
  groups: {
    jab: { frames: ["3", "4"] },
    kicks: { frames: ["7", "8", "9"] },
    high_kick: { frames: ["8", "9"] },
  },
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

  it("finds the move from any one of its frames, whatever the order", () => {
    expect(read("po4").moves).toEqual([{ name: "jab", frames: ["3", "4"] }]);
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
  it("is settled by one animation, even inside two moves", () => {
    // 3 is in `jab` only, but 8 sits in `kicks` and `high_kick` alike.
    expect(isAmbiguous(read("po3"))).toBe(false);
    const nested = readToken("po8", { ...DATA, animations: { kicks: { steps: [{ frame: "8" }] } } });
    expect(isAmbiguous(nested as Reading)).toBe(false);
  });

  it("asks when two animations play the frame", () => {
    expect(isAmbiguous(read("po9"))).toBe(true);
  });

  it("asks when nothing plays it and two moves hold it", () => {
    const bare = readToken("po8", { ...DATA, animations: {} }) as Reading;
    expect(isAmbiguous(bare)).toBe(true);
  });
});

describe("goku's data", () => {
  const goku = (file: string) =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../data/entities/goku_old/${file}`, import.meta.url)), "utf8"),
    );

  it("reads kb39 as both kicks drawn from frame 39, for the owner to choose", () => {
    const r = readToken("kb39", {
      groups: goku("descriptions.json").groups,
      animations: goku("animations.json"),
      states: goku("states.json").states,
      types: HIT_TYPES,
    }) as Reading;
    expect(r.type).toBe("knockback");
    expect(r.animations.map((a) => a.name).sort()).toEqual(["kick_high", "kick_high_hold"]);
    expect(isAmbiguous(r)).toBe(true);
  });
});
