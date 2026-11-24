import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { withOverrides } from "./overrides";

const COMMON: StatesFile = {
  initial: "idle",
  states: {
    idle: { anim: "m00" },
    jab: { anim: "m90", type: "light", damage: 10, fires: { spawn: "spark", at: [10, -40] } },
    jump: { anim: "m06", air: [[2, { vx: 2, vy: -9 }]] },
  },
};

describe("withOverrides", () => {
  it("lays his fields on a common state, an object merged and an array replaced whole", () => {
    const out = withOverrides(COMMON, { jab: { damage: 12, fires: { spawn: "spark", at: [12, -38] } }, jump: { air: [[2, { vx: 3, vy: -10 }]] } }, null);
    expect(out.states.jab).toEqual({ anim: "m90", type: "light", damage: 12, fires: { spawn: "spark", at: [12, -38] } });
    expect(out.states.jump.air).toEqual([[2, { vx: 3, vy: -10 }]]);
    expect(out.states.idle).toBe(COMMON.states.idle);
  });

  it("merges an object field by field, keeping what it does not name", () => {
    const out = withOverrides(COMMON, { jab: { fires: { at: [12, -38] } } as never }, null);
    expect(out.states.jab.fires).toEqual({ spawn: "spark", at: [12, -38] });
  });

  it("leaves the common file as it was", () => {
    withOverrides(COMMON, { jab: { damage: 12 } }, null);
    expect(COMMON.states.jab.damage).toBe(10);
  });

  it("refuses a state he does not have, one of his own, and a field that would not change", () => {
    expect(() => withOverrides(COMMON, { kick: { damage: 1 } }, null)).toThrow(/no such state/);
    expect(() => withOverrides(COMMON, { jab: { damage: 1 } }, { states: {}, replaces: { jab: "" } })).toThrow(/his own/);
    expect(() => withOverrides(COMMON, { jab: { damage: 10 } }, null)).toThrow(/what it is already/);
  });
});
