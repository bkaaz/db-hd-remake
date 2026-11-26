import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

/** Goku's Kamehameha with Boost (RB) held: `combat.md`, The buttons. */
const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
const exits = (s: string) => (states[s].transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);

describe("Goku's Kamehameha boosted", () => {
  it("plays its own charge fast with Boost held, the world still, into the large one; else the small one at once", () => {
    expect(exits("kame_charge").slice(0, 2)).toEqual(["held:boost+ki:10>kame_boost", "held:boost>kame_go_s"]);
    expect(states.kame_boost).toMatchObject({ anim: states.kame_charge.anim, freezesFoe: 18 });
    expect(exits("kame_boost")).toEqual(["frames:18>kame_go_l"]);
  });

  it("costs a bar over the Kamehameha's own price, and adds no sound or flash of the boost's own", () => {
    expect((states.kame_charge.cost ?? 0) + (states.kame_boost.cost ?? 0)).toBe(20);
    expect([states.kame_boost.sound, states.kame_boost.blinks]).toEqual([undefined, undefined]);
  });
});
