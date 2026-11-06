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

describe("Seizures, a scene that throws him and takes him back", () => {
  const def: SeizeDef = {
    at: 0,
    anim: "held",
    launch: { frame: 2, vel: [0, -17], from: [38, 0] },
    steps: [
      { frame: 4, lands: true, at: [0, -130], drift: [0, -4] },
      { frame: 6, drift: null, on: [-32, 0] },
      { frame: 8, on: null, drift: [8, 500] },
    ],
    release: { frame: 50, damage: 0, reaction: "hurt", vel: [0, 0] },
  };
  const seizer = { seize: def, state: "scene", stateFrame: 1, x: 100, y: 150, facing: 1, scaleOf: 1, showBars: vi.fn(), showThrownBall: vi.fn() } as unknown as Entity & { stateFrame: number };
  const held = () => ({ x: 300, y: 200, facing: -1, scaleOf: 1, floor: 200, ownGravity: 0.5, hold: vi.fn(), hide: vi.fn(), sound: vi.fn(), hurtBy: vi.fn(), release: vi.fn() }) as unknown as Entity;

  /** The opponent as frame `until` of the scene leaves him. */
  function at(until: number): Entity {
    const h = held();
    const seizures = new Seizures();
    for (let frame = 0; frame <= until; frame++) {
      seizer.stateFrame = frame + 1;
      seizures.update(seizer, h, {} as SeizeWorld);
    }
    return h;
  }

  it("does not throw him a second time once a step has landed him", () => {
    expect(at(4)).toMatchObject({ x: 100, y: 66 });
    expect(at(5)).toMatchObject({ x: 100, y: 62 });
  });

  it("keeps him at his offset from the seizer, in the air", () => {
    expect(at(7)).toMatchObject({ x: 68, y: 150 });
  });

  it("stops a drift at the floor", () => {
    expect(at(8)).toMatchObject({ x: 76, y: 200 });
  });
});

describe("Seizures, a scene's blows", () => {
  const def: SeizeDef = {
    at: 0,
    anim: "held",
    still: true,
    steps: [{ frame: 3, anim: "thrown", toHold: true, cry: "voice_hurt", sound: "boom" }],
    sparks: [{ frame: 2, at: [-8, -120], sound: "hit_09", pause: 2 }],
    release: { frame: 50, damage: 0, reaction: "hurt", vel: [0, 0] },
  };
  function setup() {
    const seizer = { seize: def, state: "scene", stateFrame: 1, x: 100, y: 200, facing: 1, scaleOf: 1, sound: vi.fn(), freeze: vi.fn(), showBars: vi.fn(), showThrownBall: vi.fn() };
    const held = { x: 300, y: 200, facing: -1, scaleOf: 1, floor: 200, hold: vi.fn(), holdStill: vi.fn(), holdToScript: vi.fn(), hide: vi.fn(), sound: vi.fn(), freeze: vi.fn(), hurtBy: vi.fn(), release: vi.fn() };
    const effect = vi.fn();
    return { seizer, held, effect, seizures: new Seizures(), world: { effect, screen: vi.fn() } as unknown as SeizeWorld };
  }

  it("sounds and pauses the pair with its spark, once however long the pause", () => {
    const { seizer, held, effect, seizures, world } = setup();
    for (const frame of [0, 1, 2]) {
      seizer.stateFrame = frame + 1;
      seizures.update(seizer as unknown as Entity, held as unknown as Entity, world);
    }
    expect(effect).toHaveBeenCalledWith("hit_spark", 92, 80);
    expect(seizer.sound).toHaveBeenCalledWith("hit_09");
    expect(seizer.freeze).toHaveBeenCalledWith(2);
    expect(held.freeze).toHaveBeenCalledWith(2);
    // the state's frame stands through the pause, and a later state's count must not run on
    for (let i = 0; i < 2; i++) seizures.update(seizer as unknown as Entity, held as unknown as Entity, world);
    expect(effect).toHaveBeenCalledTimes(1);
    expect(seizer.freeze).toHaveBeenCalledTimes(1);
  });

  it("keeps him on his drawing, a step plays on to the script's hold, cries and sounds", () => {
    const { seizer, held, seizures, world } = setup();
    // frame 2's spark pauses the scene for two updates
    for (const frame of [0, 1, 2, 2, 2, 3]) {
      seizer.stateFrame = frame + 1;
      seizures.update(seizer as unknown as Entity, held as unknown as Entity, world);
    }
    expect(held.holdStill).toHaveBeenCalledTimes(1);
    expect(held.hold).toHaveBeenLastCalledWith("thrown");
    expect(held.holdToScript).toHaveBeenCalledTimes(1);
    expect(held.sound).toHaveBeenCalledWith("voice_hurt");
    expect(seizer.sound).toHaveBeenCalledWith("boom");
  });
});
