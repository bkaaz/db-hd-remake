import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { draftSpecials } from "./draft";
import { framesOf, objectName } from "./draftObjects";
import { tablesOf } from "./fighterStates";

describe("objectName", () => {
  it("names an object by its fighter, type and animation", () => {
    expect(objectName("gotenks", { type: 3, anim: 8 })).toBe("gotenks_3_08");
  });
});

describe.skipIf(!existsSync(ROM_PATH))("draftSpecials, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const draft = (name: string, names: Record<string, string>, normals: Record<string, string> = {}) =>
    draftSpecials(rom, tablesOf(rom, name), names, (type, anim) => objectName(name, { type, anim }), (type) => type !== "other", normals);

  it("follows what a landing sets past the landing itself: Gotenks's a8 into aa", () => {
    const { states } = draft("gotenks", { a8: "wild_boar", aa: "after" }).specials;
    expect(states.wild_boar_2.transitions).toContainEqual({ when: "landed", to: "after" });
    expect(states.after.anim).toBe("maa");
  });

  it("goes on into the move the script's end sets: Gotenks's a5 into a6", () => {
    const { states } = draft("gotenks", { a5: "slide", a6: "slide_end" }).specials;
    expect(states.slide.transitions).toContainEqual({ when: "animEnd", to: "slide_end" });
  });

  it("goes back to the crouch a crouching blow's handler sets: Gotenks's 95", () => {
    const { states } = draft("gotenks", {}, { "95": "low_kick" }).specials;
    expect(states.low_kick.transitions).toContainEqual({ when: "animEnd", to: "crouch" });
  });

  it("steps forward through the step a handler's speed is on: Gotenks's 92", () => {
    const { states } = draft("gotenks", {}, { "92": "far" }).specials;
    expect(states.far.velAt).toEqual([[4, 2], [14, 0]]);
  });

  it("asks for a move only another leads to from that move's states, once it has connected", () => {
    const { specials } = draft("gotenks", { a5: "slide", a7: "combo" });
    expect(specials.states.slide.transitions?.[0]).toEqual({ when: ["connected", "command:a7"], to: "combo" });
    expect(specials.entries.some((e) => e.to === "combo")).toBe(false);
  });

  it("asks for an ultimate at his health, and a move in the air from a jump", () => {
    const { entries } = draft("gohan", { ae: "ultimate", a8: "dive" }).specials;
    expect(entries.find((e) => e.to === "ultimate")?.when).toEqual(["command:ae", "health:80"]);
    expect(entries.filter((e) => e.to === "dive").map((e) => e.from[0])).toEqual(["jump_up", "jump_fall"]);
  });

  it("hangs a move begun in the air, and takes off where a handler sets vy", () => {
    const { states } = draft("gohan", { a8: "dive", a6: "rise" }).specials;
    expect(states.dive.air?.[0]).toEqual([0, { vx: 0, vy: 0, gravity: 0 }]);
    expect(states.rise_2.air?.some(([, step]) => step.vy === -7 && step.gravity === 0)).toBe(true);
  });

  it("charges health for what its command costs, on the first state only", () => {
    const { states } = draft("gohan", { ad: "masenko" }).specials;
    expect(states.masenko.healthCost).toBe(10);
    expect(states.masenko_2.healthCost).toBeUndefined();
  });

  it("counts an object's frames from its table", () => {
    expect(framesOf(rom, 3, 8)).toHaveLength(6);
  });
});
