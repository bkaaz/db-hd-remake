import { describe, expect, it } from "vitest";
import { Swing } from "./swing";

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
