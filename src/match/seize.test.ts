import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entity/entity";
import type { SeizeDef } from "../entity/states";
import { flightStep, Seizures, type Flight, type SeizeWorld } from "./seize";

/** Every frame of a flight until it lies still, as [y, landed]. */
function fly(start: Flight, gravity: number): { ys: number[]; landings: number } {
  const ys: number[] = [];
  let landings = 0;
  let f: Flight = start;
  for (let i = 0; i < 500; i++) {
    const next = flightStep(f, gravity, 0);
    ys.push(next.y);
    if (next.landed) landings++;
    if (next.still) return { ys, landings };
    f = next;
  }
  throw new Error("never came to rest");
}

describe("flightStep", () => {
  // Saiyan Meteor's: thrown up at 8, then off the floor at 3 and at 1.5 ($20:8CCE)
  const thrown: Flight = { y: 0, vy: -8, bounces: [-3, -1.5] };

  it("lands three times — two bounces, then still", () => {
    expect(fly(thrown, 0.5).landings).toBe(3);
  });

  it("never goes below the floor", () => {
    expect(Math.max(...fly(thrown, 0.5).ys)).toBe(0);
  });

  it("leaves the floor at the next bounce's speed", () => {
    // a body one frame above the floor, falling
    const next = flightStep({ y: -1, vy: 2, bounces: [-3, -1.5] }, 0.5, 0);
    expect(next).toEqual({ y: 0, vy: -3, bounces: [-1.5], landed: true, still: false });
  });

  it("rises without landing however near the floor it starts", () => {
    expect(flightStep({ y: 0, vy: -8, bounces: [] }, 0.5, 0)).toMatchObject({ y: -8, vy: -7.5, landed: false });
  });
});

describe("Seizures, a scene that hides him", () => {
  const def: SeizeDef = { at: 0, anim: "held", cry: "voice_hurt", hides: 2, release: { frame: 4, damage: 120, reaction: "reel_down", vel: [2.5, -7] } };
  const seizer = () => ({ seize: def, state: "scene", stateFrame: 1, x: 100, y: 200, facing: 1, scaleOf: 1 }) as unknown as Entity & { stateFrame: number };
  const held = () =>
    ({ x: 300, y: 200, facing: -1, scaleOf: 1, floor: 200, hold: vi.fn(), hide: vi.fn(), sound: vi.fn(), hurtBy: vi.fn(), release: vi.fn() }) as unknown as Entity;
  const world = {} as SeizeWorld;

  function play(s: Entity & { stateFrame: number }, h: Entity, until: number) {
    const seizures = new Seizures();
    for (let frame = 1; frame <= until; frame++) {
      s.stateFrame = frame;
      seizures.update(s, h, world);
    }
  }

  it("takes him where he stands, crying out, and hides him on its frame", () => {
    const h = held();
    play(seizer(), h, 2);
    expect([h.x, h.y]).toEqual([300, 200]);
    expect(h.sound).toHaveBeenCalledWith("voice_hurt");
    expect(h.hide).not.toHaveBeenCalled();
    play(seizer(), h, 3);
    expect(h.hide).toHaveBeenCalledWith(true);
  });

  it("lets him go seen, hurt, where he was", () => {
    const h = held();
    play(seizer(), h, 5);
    expect(h.hide).toHaveBeenLastCalledWith(false);
    expect([h.x, h.y]).toEqual([300, 200]);
    expect(h.hurtBy).toHaveBeenCalledWith(120);
    expect(h.release).toHaveBeenCalledWith("reel_down", [2.5, -7]);
  });
});
