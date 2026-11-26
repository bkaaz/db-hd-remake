import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextRadius } from "../combat/ball";
import type { StatesFile } from "./states";

/**
 * A Kamehameha with Boost (RB) held: `combat.md`, The buttons. Each fighter's
 * charge by hand, state by state and frame by frame, to the large one; and the
 * state the boost goes on into.
 */
const FIGHTERS: [name: string, byHand: [string, number][], next: string][] = [
  ["goku", [["kame_charge", 20], ["kame_charge_2", 12]], "kame_go_l"],
  ["gohan", [["kame_charge", 20], ["kame_charge_2", 12], ["kame_charge_3", 4], ["kame_charge_4", 8]], "kame_fire_l"],
];

describe.each(FIGHTERS)("%s's Kamehameha boosted", (name, byHand, next) => {
  const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
  const exits = (s: string) => (states[s].transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);

  it("plays its own charge fast with Boost held, the world still, into the large one; else the small one at once", () => {
    expect(exits("kame_charge").slice(0, 2)).toEqual(["held:boost+ki:10>kame_boost", "held:boost>kame_go_s"]);
    expect(states.kame_boost).toMatchObject({ anim: states.kame_charge.anim, freezesFoe: 18 });
    expect(exits("kame_boost")).toEqual([`frames:18>${next}`]);
  });

  it("grows the ball at his hands at once, to what a whole charge by hand leaves", () => {
    const grown = (parts: [string, number][]) =>
      parts.reduce((r, [state, frames]) => [...Array(frames).keys()].reduce((at, f) => nextRadius(at, states[state].ball, f), r), 0);
    expect(grown([["kame_boost", 3]])).toBeGreaterThan(0);
    expect(grown([["kame_boost", 18]])).toBeCloseTo(grown(byHand));
  });

  it("costs a bar over the Kamehameha's own price, and adds no sound or flash of the boost's own", () => {
    expect((states.kame_charge.cost ?? 0) + (states.kame_boost.cost ?? 0)).toBe(20);
    expect([states.kame_boost.sound, states.kame_boost.blinks]).toEqual([undefined, undefined]);
  });
});
