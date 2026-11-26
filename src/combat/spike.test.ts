import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";

/** A spike (`combat.md`, Vanish): driven into the floor, which hurts, and the chase's last. */
describe("a spike", () => {
  const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;

  it("drives him into the floor and off it, the floor costing 20", () => {
    expect(states.spiked.transitions).toContainEqual({ when: "landed", to: "ground_bounce" });
    expect(states.ground_bounce.hurts).toBe(20);
  });

  it("ends the chase: off the floor he is open to a blow, never to a vanish", () => {
    expect(states.ground_bounce.chaseable).toBeUndefined();
    expect(states.ground_bounce.airborne).toBe(true);
  });
});
