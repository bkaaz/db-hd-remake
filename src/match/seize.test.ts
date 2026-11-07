import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entity/entity";
import type { SeizeDef } from "../entity/states";
import { flightStep, lightOn, Seizures, type Flight, type SeizeWorld } from "./seize";

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
  const seizer = () => ({ takeFreeScene: () => null, seize: def, state: "scene", stateFrame: 1, x: 100, y: 200, facing: 1, scaleOf: 1 }) as unknown as Entity & { stateFrame: number };
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

  it("puts him in another state as he lands, once let go: Putty Uppercut's (`whenLands`)", () => {
    const s = seizer();
    (s as unknown as { seize: SeizeDef }).seize = { ...def, release: { ...def.release, whenLands: { from: "tumble_bounce", to: "down_bounce", vel: [0, -3] } } };
    const h = held();
    const release = h.release as ReturnType<typeof vi.fn>;
    const seizures = new Seizures();
    for (let frame = 1; frame <= 6; frame++) {
      s.stateFrame = frame;
      seizures.update(s, h, world);
    }
    expect(release).toHaveBeenCalledTimes(1);
    (h as unknown as { state: string }).state = "tumble_bounce";
    s.stateFrame = 7;
    seizures.update(s, h, world);
    expect(release).toHaveBeenLastCalledWith("down_bounce", [0, -3]);
  });

  it("keeps him at a step's `onBy` for his name, its `on` for anyone else", () => {
    const steps = [{ frame: 1, on: [32, -63] as [number, number], onBy: { vegetto: [24, -55] as [number, number] } }];
    for (const [name, x] of [["goku", 132], ["vegetto", 124]] as const) {
      const s = seizer();
      (s as unknown as { seize: SeizeDef }).seize = { ...def, hides: undefined, steps };
      const h = held();
      (h as unknown as { name: string }).name = name;
      const seizures = new Seizures();
      for (let frame = 1; frame <= 3; frame++) {
        s.stateFrame = frame;
        seizures.update(s, h, world);
      }
      expect(h.x).toBe(x);
    }
  });

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

describe("Seizures, a scene that flashes him: his 5f, Oyatsu Kosen's ($0F:A92F)", () => {
  it("flashes him in his candy palettes until its frame, then stops", () => {
    const def: SeizeDef = { at: 0, anim: "m5f", flashes: 3, release: { frame: 9, damage: 80, reaction: "reel_down", vel: [2.5, -7] } };
    const seizer = { takeFreeScene: () => null, seize: def, state: "scene", stateFrame: 1, x: 100, y: 200, facing: 1, scaleOf: 1 } as unknown as Entity & { stateFrame: number };
    const flash = vi.fn();
    const held = { x: 300, y: 200, facing: -1, scaleOf: 1, floor: 200, hold: vi.fn(), hide: vi.fn(), sound: vi.fn(), flash } as unknown as Entity;
    const seizures = new Seizures();
    for (let frame = 1; frame <= 5; frame++) {
      seizer.stateFrame = frame;
      seizures.update(seizer, held, {} as SeizeWorld);
    }
    expect(flash.mock.calls.map(([kind]) => kind)).toEqual(["candy", "candy", null, null]);
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
  const seizer = { takeFreeScene: () => null, seize: def, state: "scene", stateFrame: 1, x: 100, y: 150, facing: 1, scaleOf: 1, showBars: vi.fn(), showThrownBall: vi.fn() } as unknown as Entity & { stateFrame: number };
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
    const seizer = { takeFreeScene: () => null, seize: def, state: "scene", stateFrame: 1, x: 100, y: 200, facing: 1, scaleOf: 1, sound: vi.fn(), freeze: vi.fn(), showBars: vi.fn(), showThrownBall: vi.fn() };
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

describe("a scene its seizer plays no part in", () => {
  const scene: SeizeDef = { at: 0, free: true, anim: "m37", light: { from: 0, start: 56, top: 57, at: [0, -48], flickers: true }, release: { frame: 3, damage: 80, reaction: "reel_down", vel: [-2, -4], ahead: true, burns: true, fx: "burst_l", fxAbove: 40, flash: 16 } };

  function pair() {
    const opened: (SeizeDef | null)[] = [scene];
    const seizer = { takeFreeScene: () => opened.shift() ?? null, seize: undefined, state: "ac", stateFrame: 90, x: 100, y: 200, facing: 1, scaleOf: 1, showThrownBall: vi.fn() } as unknown as Entity & { state: string };
    const held = { name: "goku", x: 300, y: 200, facing: -1, scaleOf: 1, floor: 200, hold: vi.fn(), hide: vi.fn(), sound: vi.fn(), hurtBy: vi.fn(), release: vi.fn(), setBurning: vi.fn() } as unknown as Entity;
    const world = { effect: vi.fn(), flash: vi.fn() } as unknown as SeizeWorld;
    return { seizer, held, world };
  }

  it("goes on by its own clock when he changes state, and lets go on its own frame", () => {
    const { seizer, held, world } = pair();
    const seizures = new Seizures();
    seizures.update(seizer, held, world);
    expect(held.hold).toHaveBeenCalledWith("m37");
    seizures.update(seizer, held, world);
    seizer.state = "idle";
    seizures.update(seizer, held, world);
    expect(held.release).not.toHaveBeenCalled();
    seizures.update(seizer, held, world);
    expect(held.release).toHaveBeenCalledWith("reel_down", [-2, -4]);
    expect(held.hurtBy).toHaveBeenCalledWith(80);
  });

  it("burns him, whitens the screen and bursts over his middle as it lets go, and asks nothing after", () => {
    const { seizer, held, world } = pair();
    const seizures = new Seizures();
    for (let i = 0; i < 6; i++) seizures.update(seizer, held, world);
    expect(held.setBurning).toHaveBeenCalledTimes(1);
    expect(world.flash).toHaveBeenCalledWith(16);
    expect(world.effect).toHaveBeenCalledWith("burst_l", 300, 160);
    expect(held.release).toHaveBeenCalledTimes(1);
    expect(seizer.showThrownBall).toHaveBeenLastCalledWith(null);
  });
});

describe("lightOn", () => {
  const held = { x: 300, y: 200 };

  it("flickers between its two radii for as long as it lasts: $74 & 1 + 0x38 ($0F:A417)", () => {
    const light = { from: 0, start: 56, top: 57, at: [0, -48] as [number, number], flickers: true as const };
    expect([0, 1, 2, 3, 200].map((f) => lightOn(light, f, held, 1)?.radius)).toEqual([56, 57, 56, 57, 56]);
    expect(lightOn(light, 0, held, 1)).toMatchObject({ x: 300, y: 152 });
  });

  it("without it rises to the top and falls away", () => {
    const light = { from: 0, start: 1, top: 2, at: [0, 0] as [number, number] };
    expect([0, 1, 2, 3].map((f) => lightOn(light, f, held, 1)?.radius)).toEqual([1, 2, 1, undefined]);
  });
});
