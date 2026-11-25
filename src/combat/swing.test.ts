import { describe, expect, it } from "vitest";
import { activeEndOf, cancelWindow, Swing, type AnimSteps } from "./swing";

/** Advance `n` live frames. */
const wait = (s: Swing, n: number): void => {
  for (let i = 0; i < n; i++) s.tick();
};

describe("Swing", () => {
  it("tells a block from a hit, until the next state", () => {
    const swing = new Swing();
    swing.hit(undefined);
    expect(swing.blocked).toBe(false);
    swing.block();
    expect([swing.spent, swing.blocked]).toEqual([true, true]);
    swing.reset();
    expect(swing.blocked).toBe(false);
  });

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

describe("cancelWindow", () => {
  it("opens on the frame after the last hit box, so the swing is seen whole", () => {
    expect(cancelWindow(KICK, 9)?.[0]).toBe(8);
  });

  it("closes on cancelBy", () => {
    expect(cancelWindow(KICK, 9)?.[1]).toBe(9);
  });

  it("stays open to the end when the attack has no cancelBy", () => {
    expect(cancelWindow(KICK, undefined)?.[1]).toBe(Infinity);
  });

  it("opens on the last frame when the hit box is drawn to the end", () => {
    const toTheEnd = { steps: [{ dur: 3 }, { dur: 4, boxes: [{ type: "hit" }] }] };
    expect(cancelWindow(toTheEnd, undefined)?.[0]).toBe(7);
  });

  it("does not exist for an animation that cannot hit", () => {
    expect(cancelWindow({ steps: [{ dur: 5 }] }, 9)).toBeNull();
  });
});
