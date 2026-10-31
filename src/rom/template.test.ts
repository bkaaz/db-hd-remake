import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { statesFrom } from "./template";

const template = {
  initial: "idle",
  onGotHit: "hurt",
  states: {
    idle: { anim: "m00", transitions: [{ when: "pressed:attack", to: "punch" }, { when: ["motion:hcf", "pressed:smash"], to: "special" }] },
    punch: { anim: "m92", type: "heavy", damage: 27, transitions: [{ when: "animEnd", to: "idle" }] },
    special: { anim: "ma5", transitions: [{ when: "animEnd", to: "idle" }] },
    shot: { anim: "m9b", fires: { spawn: "goku_ki", at: [40, -56] }, transitions: [{ when: "animEnd", to: "idle" }] },
    hurt: { anim: "m15", transitions: [{ when: "animEnd", to: "down_bounce" }] },
    down_bounce: { anim: "m1b_3", groundFx: "goku_dust", transitions: [{ when: "landed", to: "down_lie" }] },
    down_lie: { anim: "m1b_4", ifAirborne: "hurt", transitions: [{ when: "animEnd", to: "idle" }] },
  },
} as unknown as StatesFile;

const his = new Set(["m00", "m92", "ma5", "m9b", "m15", "m1b_3"]);
const made = statesFrom(template, {
  has: (a) => his.has(a),
  special: (a) => a.startsWith("ma5"),
  foreign: (v) => v.startsWith("goku_"),
  blowOf: (a) => (a === "m92" ? { type: "heavy", damage: 28 } : null),
});

describe("statesFrom, a shared shot", () => {
  const shared = { ...template, states: { shot: { anim: "m9b", fires: { spawn: "ki_blast", at: [40, -56] }, transitions: [] } } } as unknown as StatesFile;
  const his = statesFrom(shared, {
    has: () => true,
    special: () => false,
    foreign: (v) => v.startsWith("goku_"),
    blowOf: () => null,
    spawnAt: (a, s) => (a === "m9b" && s === "ki_blast" ? [28, -48] : null),
  });

  it("keeps it, leaving from where his own script puts it out", () => {
    expect(his.file.states.shot.fires).toEqual({ spawn: "ki_blast", at: [28, -48] });
    expect(his.moved).toEqual({ shot: [[40, -56], [28, -48]] });
  });
});

describe("statesFrom", () => {
  it("drops the template's specials, though he has an animation of that id, and what he cannot play", () => {
    expect(made.dropped).toEqual({ special: "the template's special ma5", down_lie: "no m1b_4" });
  });

  it("cuts the template's own objects out of a state it keeps", () => {
    expect(made.lost).toEqual({ shot: ["goku_ki"], down_bounce: ["goku_dust"] });
    expect(made.file.states.shot).not.toHaveProperty("fires");
    expect(made.file.states.down_bounce).not.toHaveProperty("groundFx");
  });

  it("sends a landing on where the dropped state would have gone, and drops a press that led there", () => {
    expect(made.file.states.down_bounce.transitions).toEqual([{ when: "landed", to: "idle" }]);
    expect(made.file.states.idle.transitions).toEqual([{ when: "pressed:attack", to: "punch" }]);
  });

  it("gives every blow his own numbers", () => {
    expect(made.file.states.punch).toMatchObject({ type: "heavy", damage: 28 });
    expect(made.reblown).toEqual({ punch: ["heavy 27", "heavy 28"] });
  });
});
