import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entity/entity";
import type { GrabDef } from "../entity/states";
import { heldAt, Throws } from "./throw";

/**
 * `Throws` names an `Entity` only as a type, so it runs in Node against two
 * stand-ins answering only what a throw asks, as `blow.test.ts` does.
 */

const GRAB: GrabDef = {
  at: { goku: [[24, 0], [22, 0], [-32, -32]] },
  launch: { frame: 20, damage: 40, reaction: "reel_down", vel: [-2.5, -8] },
};

function thrower(): Entity & { stateFrame: number; animStep: number } {
  const t = {
    name: "goku",
    x: 100,
    y: 200,
    facing: 1 as const,
    state: "throw",
    grab: GRAB as GrabDef | undefined,
    animation: "m9d",
    animStep: 0,
    stateFrame: 0,
    get placement() {
      return { x: t.x, y: t.y, facing: t.facing, scale: 2 };
    },
  };
  return t as unknown as Entity & { stateFrame: number; animStep: number };
}

function held(): Entity {
  return {
    name: "goku",
    x: 130,
    y: 200,
    // turned away, as after a jump over him: the hold turns him round
    facing: 1,
    throwable: true,
    hold: vi.fn(),
    release: vi.fn(),
    hurtBy: vi.fn(),
  } as unknown as Entity;
}

describe("heldAt", () => {
  it("puts him at the step's offset toward the thrower's facing, the last one past the table's end", () => {
    const by = { x: 100, y: 200, facing: -1 as const, scale: 2 };
    expect(heldAt([[24, 0], [-32, -32]], 0, by)).toEqual({ x: 52, y: 200 });
    expect(heldAt([[24, 0], [-32, -32]], 5, by)).toEqual({ x: 164, y: 136 });
    expect(heldAt(undefined, 0, by)).toBeNull();
  });
});

describe("Throws", () => {
  it("takes hold as the throw begins: his animation for this thrower and move, facing the thrower, at the first step", () => {
    const t = thrower();
    const h = held();
    new Throws().update(t, h);
    expect(h.hold).toHaveBeenCalledWith("m30_goku_9d");
    expect(h.facing).toBe(-1);
    expect([h.x, h.y]).toEqual([148, 200]);
  });

  it("lets him go on the launch's frame: the damage, the reaction at its speed, facing the thrower's way", () => {
    const t = thrower();
    const h = held();
    const throws = new Throws();
    throws.update(t, h);
    t.animStep = 2;
    // the state's 21st frame is the move's frame 20: the entry frame counts 1 here, 0 there
    t.stateFrame = 20;
    throws.update(t, h);
    expect(h.release).not.toHaveBeenCalled();
    t.stateFrame = 21;
    throws.update(t, h);
    expect(h.hurtBy).toHaveBeenCalledWith(40);
    expect(h.release).toHaveBeenCalledWith("reel_down", [-2.5, -8]);
    expect(h.facing).toBe(1);
    // put where the last step holds him, then let go once
    expect([h.x, h.y]).toEqual([36, 136]);
    throws.update(t, h);
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it("lets him go where he stands when the throw is cut short", () => {
    const t = thrower();
    const h = held();
    const throws = new Throws();
    throws.update(t, h);
    Object.assign(t, { state: "hurt", grab: undefined });
    throws.update(t, h);
    expect(h.release).toHaveBeenCalledWith();
    expect(h.hurtBy).not.toHaveBeenCalled();
  });

  it("holds nobody who cannot be thrown", () => {
    const h = Object.assign(held(), { throwable: false });
    new Throws().update(thrower(), h);
    expect(h.hold).not.toHaveBeenCalled();
  });
});
