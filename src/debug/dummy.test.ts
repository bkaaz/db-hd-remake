import { describe, expect, it } from "vitest";
import { Dummy, type Script } from "./dummy";

/** The dummy, built or blown up — every test wants one or the other. */
function built(script: Script): Dummy {
  const dummy = Dummy.from(script);
  if (typeof dummy === "string") throw new Error(dummy);
  return dummy;
}

/** `frames` frames of input, facing left, which is where the opponent stands. */
function run(dummy: Dummy, frames: number): ReturnType<Dummy["input"]>[] {
  return Array.from({ length: frames }, () => dummy.input({ on: true, facing: -1, frozen: false }));
}

describe("the debug dummy", () => {
  it("presses a button on the first frame of its step and no more", () => {
    // Held, an edge would re-press sixty times a second — one step of "attack"
    // is one press.
    const frames = run(built({ does: ["attack 5"], loop: false }), 5);
    expect(frames.map((f) => f.attack)).toEqual([true, false, false, false, false]);
  });

  it("holds a direction for the whole step", () => {
    const frames = run(built({ does: ["back 3"], loop: false }), 4);
    expect(frames.map((f) => f.right)).toEqual([true, true, true, false]);
  });

  it("reads back and fwd off the dummy's own facing", () => {
    const facingRight = Dummy.from({ does: ["back"] });
    if (typeof facingRight === "string") throw new Error(facingRight);
    expect(facingRight.input({ on: true, facing: 1, frozen: false }).left).toBe(true);
    expect(built({ does: ["back"] }).input({ on: true, facing: -1, frozen: false }).right).toBe(true);
  });

  it("does nothing for a bare number of frames", () => {
    const frames = run(built({ does: [2, "attack"], loop: false }), 3);
    expect(frames.map((f) => f.attack)).toEqual([false, false, true]);
  });

  it("loops by default and stops when told not to", () => {
    expect(run(built({ does: [2, "attack"] }), 6).map((f) => f.attack)).toEqual([
      false, false, true, false, false, true,
    ]);
    expect(run(built({ does: [2, "attack"], loop: false }), 6).map((f) => f.attack)).toEqual([
      false, false, true, false, false, false,
    ]);
  });

  it("guards on top of the timeline, not instead of it", () => {
    const frames = run(built({ does: ["attack 2", 2], guard: "always" }), 4);
    expect(frames.map((f) => f.attack)).toEqual([true, false, false, false]);
    // Let go for the swing, or the fighter would stand in guard and never throw it.
    expect(frames.map((f) => f.holding.guard)).toEqual([false, false, true, true]);
  });

  it("rewinds when switched off, so two runs are comparable", () => {
    const dummy = built({ does: [2, "attack"] });
    dummy.input({ on: true, facing: -1, frozen: false });
    dummy.input({ on: false, facing: -1, frozen: false });
    expect(run(dummy, 3).map((f) => f.attack)).toEqual([false, false, true]);
  });

  it("keeps swinging on a timer when a mode says nothing about it", () => {
    // The behaviour `T` has always had, now expressed as the default script.
    const frames = run(built({}), 91);
    expect(frames.slice(0, 90).some((f) => f.attack)).toBe(false);
    expect(frames[90].attack).toBe(true);
  });

  it("stops the clock while its body is frozen", () => {
    // Ten frames of hit pause per blow would otherwise drift the timeline, so
    // the same script would mean one thing on a whiff and another in a combo.
    const dummy = built({ does: [2, "guard"] });
    for (let i = 0; i < 30; i++) {
      expect(dummy.input({ on: true, facing: -1, frozen: true }).guard).toBe(false);
    }
    expect(run(dummy, 3).map((f) => f.guard)).toEqual([false, false, true]);
  });

  it("refuses a step it cannot do, by name", () => {
    expect(Dummy.from({ does: ["punch"] })).toBe('"punch" is not something the dummy can do');
    expect(Dummy.from({ does: ["attack 0"] })).toContain("at least one frame");
  });
});

describe("a dummy that only ever crouches", () => {
  /** What `data/debug.json` mode 4 says: hold down, forever. */
  const script = { does: ["down 60"] };

  it("holds down on every frame, including across the loop", () => {
    const dummy = Dummy.from(script);
    if (typeof dummy === "string") throw new Error(dummy);
    // Past the end of the single 60-frame step, so the wrap is covered too.
    for (let i = 0; i < 130; i++) {
      expect(dummy.input({ on: true, facing: 1, frozen: false }).down).toBe(true);
    }
  });

  it("presses nothing else, so what a blow lands on is the crouch alone", () => {
    const dummy = Dummy.from(script);
    if (typeof dummy === "string") throw new Error(dummy);
    for (let i = 0; i < 130; i++) {
      const world = dummy.input({ on: true, facing: 1, frozen: false });
      const { down, holding, ...rest } = world;
      expect(Object.values(rest).every((v) => v === false)).toBe(true);
      // Held buttons are the same claim about a second kind of input: a dummy
      // that presses nothing must not be leaning on anything either.
      expect(Object.values(holding).every((v) => v === false)).toBe(true);
    }
  });
});
