import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

/**
 * Every intro is over when its animation is, with no pose held after it: the
 * original's longer holds timed its own screen, played one fighter at a time,
 * and on our shared arena they were only standing before READY (owner,
 * 2026-11-27).
 */
describe("an intro", () => {
  const fighters = readdirSync("data/entities").filter((e) => {
    try {
      return !!(JSON.parse(readFileSync(`data/entities/${e}/states.json`, "utf8")) as StatesFile).states.intro;
    } catch {
      return false;
    }
  });

  it.each(fighters)("of %s ends with its animation", (e) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${e}/states.json`, "utf8")) as StatesFile;
    expect(states.intro.holdStep).toBeUndefined();
    // what follows is his own: Gotenks's discharges play on under READY
    expect((states.intro.transitions ?? []).map((t) => t.when)).toEqual(["animEnd"]);
  });
});
