import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { withSpecials, type SpecialsFile } from "./specials";

const TEMPLATE: StatesFile = {
  initial: "idle",
  states: {
    idle: {
      anim: "m00",
      transitions: [
        { when: "held:down", to: "crouch" },
        { when: ["pressed:smash", "close:smash"], to: "kick" },
        { when: "pressed:blast", to: "ki" },
      ],
    },
    crouch: { anim: "m01" },
    kick: { anim: "m02" },
    ki: { anim: "m03" },
  },
};

const BALL: SpecialsFile = {
  entries: [{ from: ["idle"], when: ["motion:hcf", "pressed:blast"], to: "ball" }],
  states: { ball: { anim: "mad" } },
};

describe("withSpecials", () => {
  it("adds his special and puts its entry just ahead of the plain press of its button", () => {
    const out = withSpecials(TEMPLATE, BALL);
    expect(out.states.ball).toEqual({ anim: "mad" });
    expect(out.states.idle.transitions!.map((t) => t.to)).toEqual(["crouch", "kick", "ball", "ki"]);
  });

  it("leaves the template's file as it was", () => {
    withSpecials(TEMPLATE, BALL);
    expect(TEMPLATE.states.idle.transitions).toHaveLength(3);
    expect(TEMPLATE.states.ball).toBeUndefined();
  });

  it("refuses a special named as a template state, an entry to nothing, and a state with no such press", () => {
    expect(() => withSpecials(TEMPLATE, { ...BALL, states: { ki: { anim: "mad" } } })).toThrow(/template makes already/);
    expect(() => withSpecials(TEMPLATE, { ...BALL, states: {} })).toThrow(/does not define/);
    expect(() => withSpecials(TEMPLATE, { ...BALL, entries: [{ ...BALL.entries[0], from: ["crouch"] }] })).toThrow(/no pressed:blast/);
  });
});
