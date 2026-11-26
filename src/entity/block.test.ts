import { describe, expect, it } from "vitest";
import { blockOf } from "./block";
import type { StatesFile } from "./states";

const file: StatesFile = {
  initial: "idle",
  onGuard: "guard_hit",
  states: {
    idle: { anim: "a", transitions: [] },
    guard: { anim: "a", guarding: true, transitions: [] },
    guard_hit: { anim: "a", guarding: true, shove: -2, transitions: [] },
    holding: { anim: "a", braces: 5, transitions: [] },
  },
};

describe("blockOf", () => {
  it("blocks in the stance's reaction where he guards, and not where he does not", () => {
    expect(blockOf(file.states.guard, file, 0, false)).toEqual({ reaction: "guard_hit" });
    expect(blockOf(file.states.idle, file, 60, false)).toBeNull();
  });

  it("blocks where he stands in a state that braces, for its ki, pushed as the stance's block is", () => {
    expect(blockOf(file.states.holding, file, 5, false)).toEqual({ cost: 5, shove: -2 });
  });

  it("lets the blow land once he has too little ki to brace, and in the air", () => {
    expect(blockOf(file.states.holding, file, 4, false)).toBeNull();
    expect(blockOf(file.states.holding, file, 60, true)).toBeNull();
  });
});
