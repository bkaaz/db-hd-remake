import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextRadius, type BallDef } from "./ball";

const charge = { at: [-10, -38] as [number, number], from: 16, grow: 2 };

describe("the charging ball", () => {
  it("appears at radius 1 on its frame, not before", () => {
    expect(nextRadius(0, charge, 15)).toBe(0);
    expect(nextRadius(0, charge, 16)).toBe(1);
  });

  it("grows by 2 a frame while charged — 53 by the original's full charge", () => {
    let r = 1;
    for (let frame = 17; frame <= 42; frame++) r = nextRadius(r, charge, frame);
    expect(r).toBe(53);
  });

  it("carries on in a state that holds it without starting one", () => {
    const carried = { at: charge.at, grow: 2 };
    expect(nextRadius(9, carried, 0)).toBe(11);
    expect(nextRadius(0, carried, 0)).toBe(0);
  });

  it("loses its radius in place on a negative grow, and stays gone", () => {
    const fades = { at: charge.at, from: 0, grow: -2 };
    expect(nextRadius(3, fades, 9)).toBe(1);
    expect(nextRadius(1, fades, 9)).toBe(0);
    expect(nextRadius(0, fades, 9)).toBe(0);
  });

  it("shrinks by 2 a frame once let go, and is gone at 0", () => {
    expect(nextRadius(3, undefined, 0)).toBe(1);
    expect(nextRadius(1, undefined, 0)).toBe(0);
  });
});

describe("a state's several balls", () => {
  // Saiyan Meteor's ae: a flicker at the hands, then one growing over the head
  const meteor = [
    { at: [24, -36] as [number, number], from: 200, until: 274, grow: 0, pulse: [7, 6, 5, 4, 3, 2, 1, 1, 15, 14, 13, 12, 11, 10, 9, 8] },
    { at: [0, -112] as [number, number], from: 306, grow: 1, max: 63 },
  ];

  it("takes the flicker's radius from its table by the frame", () => {
    expect(nextRadius(0, meteor, 200)).toBe(15);
    expect(nextRadius(15, meteor, 214)).toBe(1);
  });

  it("is gone at once between them, not shrinking", () => {
    expect(nextRadius(11, meteor, 274)).toBe(0);
  });

  it("grows the next from nothing and stops at its max", () => {
    expect(nextRadius(0, meteor, 306)).toBe(1);
    expect(nextRadius(63, meteor, 400)).toBe(63);
  });
});


describe("Mr. Buu's Energy Field", () => {
  const state = JSON.parse(readFileSync("data/entities/mr_buu/specials.json", "utf8")).states.energy_field_3 as { ball: BallDef[] };
  const steps = JSON.parse(readFileSync("data/spawns/mr_buu_8_12/animations.json", "utf8")).play.steps as { frame: string; dur: number }[];

  /** The radius on each of the state's frames, as the engine steps it. */
  function radii(): number[] {
    const all: number[] = [];
    let r = 0;
    for (let frame = 0; frame < 160; frame++) all.push((r = nextRadius(r, state.ball, frame)));
    return all;
  }

  it("grows from 1 by 2 a frame to 65, then flickers, then shrinks by 2 to nothing", () => {
    const r = radii();
    expect(r.slice(0, 4)).toEqual([1, 3, 5, 7]);
    expect(r[32]).toBe(65);
    expect(new Set(r.slice(33, 104))).toEqual(new Set([65, 66]));
    expect(r[104]).toBeLessThan(r[103]);
    expect(r.at(-1)).toBe(0);
  });

  it("strikes with the frame the radius names: radius / 4 ($0F:D90B)", () => {
    const shown = steps.flatMap((s) => Array<number>(s.dur).fill(Number(s.frame)));
    radii().forEach((r, frame) => {
      if (r > 0) expect([frame, shown[frame]]).toEqual([frame, r >> 2]);
    });
  });
});

describe("Mr. Buu's Mightiness Bomber", () => {
  const states = JSON.parse(readFileSync("data/entities/mr_buu/specials.json", "utf8")).states as Record<string, { fires: { spawn: string; at: [number, number]; state: string }; transitions: { when: string | string[] }[] }>;
  const spawn = (name: string) => JSON.parse(readFileSync(`data/spawns/${name}/states.json`, "utf8")).states as Record<string, { ball: BallDef; vel: [number, number]; lasts?: number }>;

  it("appears at a level's own start, not 1: a ball carried on from a smaller object", () => {
    expect(nextRadius(0, { at: [0, 0], from: 0, start: 17, grow: 1, max: 24 }, 0)).toBe(17);
  });

  it.each([["mr_buu_8_0f", 1, 16], ["mr_buu_8_10", 17, 24], ["mr_buu_8_11", 25, 32]])("%s grows from %i to %i at the hand, by 1 a frame ($0F:D87E), and flies at that size", (name, from, to) => {
    const { charge, fly } = spawn(name);
    let r = 0;
    const seen: number[] = [];
    for (let frame = 0; frame <= to - from + 2; frame++) seen.push((r = nextRadius(r, charge.ball, frame)));
    expect(seen[0]).toBe(from);
    expect(seen[1]).toBe(from + 1);
    expect(seen.at(-1)).toBe(to);
    expect(nextRadius(nextRadius(0, fly.ball, 0), fly.ball, 1)).toBe(to);
  });

  it("creeps 1 px a frame at the hand and leaves at 4 ($0F:F7DD)", () => {
    expect(spawn("mr_buu_8_0f").charge.vel).toEqual([1, 0]);
    expect(spawn("mr_buu_8_0f").fly.vel).toEqual([4, 0]);
  });

  it("each level takes up where the last stopped: the hand's 16, then 8, then 8 frames ($0F:F785)", () => {
    expect(states.mightiness_bomber_2.fires.at[0]).toBe(52);
    expect(states.mightiness_bomber_3.fires.at[0]).toBe(52 + 16);
    expect(states.mightiness_bomber_4.fires.at[0]).toBe(52 + 24);
    expect(states.mightiness_go_s.fires.at[0]).toBe(52 + 16);
    expect(states.mightiness_go_m.fires.at[0]).toBe(52 + 24);
    expect(states.mightiness_go_l.fires.at[0]).toBe(52 + 32);
  });

  it("goes on to the next level only while its ball is out: one that hit has nothing to charge", () => {
    for (const name of ["mightiness_bomber_2", "mightiness_bomber_3", "mightiness_bomber_4"]) {
      const timed = states[name].transitions.filter((t) => [t.when].flat().some((w) => w.startsWith("frames:")));
      expect(timed.length).toBeGreaterThan(0);
      for (const t of timed) expect(t.when).toContain("!spawnEnd");
    }
  });
});

describe("an object's ball", () => {
  it("names its first frame in the object's first state: nothing before it carries one on, so it would never appear", () => {
    for (const name of readdirSync("data/spawns")) {
      const file = `data/spawns/${name}/states.json`;
      if (!existsSync(file)) continue;
      const { initial, states } = JSON.parse(readFileSync(file, "utf8")) as { initial: string; states: Record<string, { ball?: BallDef | BallDef[] }> };
      for (const ball of [states[initial].ball ?? []].flat()) expect(ball.from ?? ball.pulse, `${name}: ${initial}`).toBeDefined();
    }
  });
});
