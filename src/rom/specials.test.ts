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
  entries: [{ from: ["idle"], when: "command:ad", to: "ball" }],
  states: { ball: { anim: "mad" } },
};

describe("withSpecials", () => {
  it("adds his special and puts its entry ahead of the first press", () => {
    const out = withSpecials(TEMPLATE, BALL);
    expect(out.states.ball).toEqual({ anim: "mad" });
    expect(out.states.idle.transitions!.map((t) => t.to)).toEqual(["crouch", "ball", "kick", "ki"]);
  });

  it("leaves the template's file as it was", () => {
    withSpecials(TEMPLATE, BALL);
    expect(TEMPLATE.states.idle.transitions).toHaveLength(3);
    expect(TEMPLATE.states.ball).toBeUndefined();
  });

  it("puts the entry first in a state with no press of its button", () => {
    const out = withSpecials(TEMPLATE, { ...BALL, entries: [{ ...BALL.entries[0], from: ["crouch"] }] });
    expect(out.states.crouch.transitions![0].to).toBe("ball");
  });

  it("refuses a special named as a template state, an entry to nothing, and one asking for no button", () => {
    expect(() => withSpecials(TEMPLATE, { ...BALL, states: { ki: { anim: "mad" } } })).toThrow(/template makes already/);
    expect(() => withSpecials(TEMPLATE, { ...BALL, states: {} })).toThrow(/does not define/);
    expect(() => withSpecials(TEMPLATE, { ...BALL, entries: [{ ...BALL.entries[0], when: "held:fwd" }] })).toThrow(/asks for no button/);
  });

  it("replaces a template state it names, and only one it names", () => {
    const out = withSpecials(TEMPLATE, { ...BALL, replaces: ["kick"], states: { ...BALL.states, kick: { anim: "m93" } } });
    expect(out.states.kick).toEqual({ anim: "m93" });
    expect(() => withSpecials(TEMPLATE, { ...BALL, replaces: ["nothing"], states: { ...BALL.states, nothing: { anim: "m93" } } })).toThrow(/makes no such state/);
    expect(() => withSpecials(TEMPLATE, { ...BALL, replaces: ["kick"] })).toThrow(/does not define it/);
  });

  it("gives him his own winner's poses, keeping the rest of the round", () => {
    const round = { ko: "ki", down: "crouch", win: ["kick", "ki"] };
    const out = withSpecials({ ...TEMPLATE, round }, { ...BALL, poses: ["kick"] });
    expect(out.round).toEqual({ ...round, win: ["kick"] });
    expect(withSpecials({ ...TEMPLATE, round }, BALL).round).toEqual(round);
    expect(() => withSpecials({ ...TEMPLATE, round }, { ...BALL, poses: ["nothing"] })).toThrow(/no state/);
  });
});
