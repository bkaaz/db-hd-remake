import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

// Every fighter with states: ki is what his specials pay and what his charge fills
// (owner, 2026-11-24), not health as the original's one pool.
const fighters = readdirSync("data/entities").filter((name) => {
  try {
    readFileSync(`data/entities/${name}/states.json`);
    return true;
  } catch {
    return false;
  }
});
const statesOf = (name: string) => (JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile).states;

describe("ki on the cartridge's fighters", () => {
  it.each(fighters)("%s's charge fills the ki meter", (name) => {
    const charge = statesOf(name).charge;
    expect(charge?.ki).toBeGreaterThan(0);
  });

  it.each(fighters)("%s pays for his specials in ki, never in health", (name) => {
    const states = Object.values(statesOf(name)) as object[];
    expect(states.filter((s) => "healthCost" in s || "heal" in s)).toEqual([]);
  });

  it("Gohan's Masenko costs what its command row says, in ki", () => {
    expect(statesOf("gohan").masenko.cost).toBe(10);
  });
});
