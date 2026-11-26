import { describe, expect, it } from "vitest";
import type { StateDef } from "../entity/states";
import { aimed, aimsIn, closeIn } from "./rushEntries";

const ENDERS = ["smash_1", "smash_2", "smash_3"];

const exits = (states: Record<string, StateDef>, s: string) => (states[s].transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);
const ground = (): Record<string, StateDef> => ({
  idle: { anim: "a", transitions: [{ when: "pressed:attack", to: "rush_1" }, { when: "pressed:smash", to: "smash" }] },
  crouch: { anim: "a", transitions: [{ when: "pressed:smash", to: "crouch_b" }] },
  jump_fall: { anim: "a", transitions: [{ when: "pressed:smash", to: "jump_b" }] },
});

describe("aimed", () => {
  it("asks for the direction alone: down-back is neither back nor down", () => {
    expect(aimed("back")).toEqual(["held:back", "!held:down", "!held:up", "pressed:smash"]);
    expect(aimed("down")).toEqual(["held:down", "!held:fwd", "!held:back", "pressed:smash"]);
  });
});

describe("aimsIn", () => {
  it("puts a direction + Smash ahead of Smash alone, standing and crouching, never in the air", () => {
    const states = ground();
    aimsIn(states, [["smash_1", "back"], ["smash_3", "down"]], ENDERS);
    expect(exits(states, "idle")).toEqual(["pressed:attack>rush_1", `${aimed("back").join("+")}>smash_1`, `${aimed("down").join("+")}>smash_3`, "pressed:smash>smash"]);
    expect(exits(states, "crouch")[0]).toBe(`${aimed("back").join("+")}>smash_1`);
    expect(exits(states, "jump_fall")).toEqual(["pressed:smash>jump_b"]);
  });

  it("takes out what an ender no longer picked left behind, and puts nothing twice", () => {
    const states = ground();
    aimsIn(states, [["smash_1", "back"], ["smash_3", "down"]], ENDERS);
    aimsIn(states, [["smash_3", "down"]], ENDERS);
    expect(exits(states, "idle")).toEqual(["pressed:attack>rush_1", `${aimed("down").join("+")}>smash_3`, "pressed:smash>smash"]);
  });

  it("leaves back + Smash into a special of his own, the air's", () => {
    const states = ground();
    states.jump_fall.transitions!.unshift({ when: aimed("back"), to: "slash_down" });
    aimsIn(states, [["smash_1", "back"]], ENDERS);
    expect(exits(states, "jump_fall")[0]).toBe(`${aimed("back").join("+")}>slash_down`);
  });
});

describe("closeIn", () => {
  it("puts A1c ahead of A1, and takes it out again when it is not picked", () => {
    const states = ground();
    closeIn(states, "rush_1_close", true);
    expect(exits(states, "idle").slice(0, 2)).toEqual(["pressed:attack+close:attack>rush_1_close", "pressed:attack>rush_1"]);
    closeIn(states, "rush_1_close", false);
    expect(exits(states, "idle")[0]).toBe("pressed:attack>rush_1");
  });
});
