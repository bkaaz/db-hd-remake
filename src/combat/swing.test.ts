import { describe, expect, it } from "vitest";
import { activeEndOf, missWindow, Swing, type AnimSteps } from "./swing";

/** Advance `n` live frames. */
const wait = (s: Swing, n: number): void => {
  for (let i = 0; i < n; i++) s.tick();
};

describe("Swing", () => {
  it("starts able to hit and having hit nothing", () => {
    const s = new Swing();
    expect(s.canHit).toBe(true);
    expect(s.spent).toBe(false);
  });

  it("lands once with no interval, however long it is held", () => {
    // Every attack in the game today. The absence of `rehit` is what says so.
    const s = new Swing();
    s.hit(undefined);
    expect(s.canHit).toBe(false);
    wait(s, 600);
    expect(s.canHit).toBe(false);
  });

  it("comes back exactly `rehit` frames later", () => {
    const s = new Swing();
    s.hit(8);
    wait(s, 7);
    expect(s.canHit).toBe(false);
    s.tick();
    expect(s.canHit).toBe(true);
  });

  it("keeps `spent` true between hits, so a cancel is never withdrawn", () => {
    // The reason the two facts were split. A chain hangs off "has connected",
    // and a multi-hit move saying "not yet" must not close that window.
    const s = new Swing();
    s.hit(4);
    expect(s.spent).toBe(true);
    wait(s, 2);
    expect(s.spent).toBe(true);
    expect(s.canHit).toBe(false);
    wait(s, 2);
    expect(s.spent).toBe(true);
    expect(s.canHit).toBe(true);
  });

  it("hits again on the frame it becomes ready, and waits again after", () => {
    const s = new Swing();
    s.hit(3);
    wait(s, 3);
    expect(s.canHit).toBe(true);
    s.hit(3);
    expect(s.canHit).toBe(false);
  });

  it("a zero interval means every frame the box is out", () => {
    const s = new Swing();
    s.hit(0);
    expect(s.canHit).toBe(true);
  });

  it("forgets everything on a new state", () => {
    const s = new Swing();
    s.hit(undefined);
    s.reset();
    expect(s.canHit).toBe(true);
    expect(s.spent).toBe(false);
  });
});

/** 4 frames of wind-up, 3 with a hit box, 6 of recovery. */
const KICK: AnimSteps = {
  steps: [
    { dur: 4, boxes: [{ type: "hurt" }] },
    { dur: 3, boxes: [{ type: "hit" }] },
    { dur: 6, boxes: [{ type: "hurt" }] },
  ],
};

describe("activeEndOf", () => {
  it("counts to the end of the last step with a hit box", () => {
    expect(activeEndOf(KICK)).toBe(7);
    const twice = { steps: [...KICK.steps, { dur: 2, boxes: [{ type: "hit" }] }] };
    expect(activeEndOf(twice)).toBe(15);
  });

  it("is zero for an animation that cannot hit", () => {
    expect(activeEndOf({ steps: [{ dur: 5, boxes: [{ type: "hurt" }] }] })).toBe(0);
    expect(activeEndOf(undefined)).toBe(0);
  });
});

describe("missWindow", () => {
  it("opens on the frame after the last hit box", () => {
    expect(missWindow(KICK, 9)?.[0]).toBe(8);
  });

  it("lasts as long as the window a hit gets", () => {
    // A hit may cancel from the start-up (4) to cancelBy (9): 5 frames.
    const [from, to] = missWindow(KICK, 9)!;
    expect(to - from + 1).toBe(9 - 4);
  });

  it("stays open to the end when the attack has no cancelBy, like a hit", () => {
    expect(missWindow(KICK, undefined)?.[1]).toBe(Infinity);
  });

  it("does not exist for an animation that cannot hit", () => {
    expect(missWindow({ steps: [{ dur: 5 }] }, 9)).toBeNull();
  });
});
