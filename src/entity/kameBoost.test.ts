import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

/**
 * A Kamehameha with Boost (RB) held: `combat.md`, The buttons. The boost
 * plays each fighter's own charge fast (`entity/boost.ts`), so all it needs is
 * where the charge begins, how long it takes by hand, and which states it is:
 * its charge by hand, state by state, and the state the charge goes on into.
 */
const FIGHTERS: [name: string, byHand: [string, number][], next: string][] = [
  ["goku", [["kame_charge", 20], ["kame_charge_2", 12]], "kame_go_l"],
  ["gohan", [["kame_charge", 20], ["kame_charge_2", 12], ["kame_charge_3", 4], ["kame_charge_4", 8]], "kame_fire_l"],
];

describe.each(FIGHTERS)("%s's Kamehameha boosted", (name, byHand, next) => {
  const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;

  it("boosts by its own charge, as long as it takes by hand, Ki held for him, for a bar over its price", () => {
    expect(states.kame_charge.boosts).toEqual({ hold: "blast", frames: byHand.reduce((n, [, f]) => n + f, 0), bar: 10, needs: 10 });
  });

  it("plays the whole charge, every state of it, and ends on the large one", () => {
    for (const [state] of byHand) expect(states[state].charging).toBe(true);
    expect(states[next].charging).toBeUndefined();
    expect(states.kame_boost).toBeUndefined();
  });

  it("is the small one at once without the ki", () => {
    expect(states.kame_charge.transitions?.[0]).toEqual({ when: ["held:boost", "!ki:10"], to: "kame_go_s" });
  });
});
