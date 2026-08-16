import { describe, expect, it } from "vitest";
import { damageScale, hitstunScale, scaledDamage, scaledHitstun } from "./scaling";

describe("combo scaling", () => {
  it("gives the opener all of itself", () => {
    expect(damageScale(0)).toBe(1);
    expect(scaledDamage(14, 0)).toBe(14);
  });

  it("takes a little more off every blow after it", () => {
    expect(scaledDamage(10, 1)).toBe(9);
    expect(scaledDamage(10, 2)).toBe(8);
    expect(scaledDamage(10, 3)).toBe(7);
  });

  it("stops falling at the floor, however long the combo runs", () => {
    expect(damageScale(8)).toBeCloseTo(0.2);
    expect(damageScale(15)).toBeCloseTo(0.2);
    expect(damageScale(100)).toBeCloseTo(0.2);
  });

  it("never lets a blow that costs something cost nothing", () => {
    // A free blow still stops and still holds the victim, so it would extend a
    // combo at no price at all.
    expect(scaledDamage(1, 50)).toBe(1);
  });

  it("leaves a blow authored as free alone", () => {
    expect(scaledDamage(0, 0)).toBe(0);
    expect(scaledDamage(0, 9)).toBe(0);
  });

  it("holds the opener for all of its hitstun", () => {
    expect(hitstunScale(0)).toBe(1);
    expect(scaledHitstun(17, 0)).toBe(17);
  });

  it("holds every blow after it a little less", () => {
    expect(scaledHitstun(20, 1)).toBe(18);
    expect(scaledHitstun(20, 2)).toBe(16);
    expect(scaledHitstun(20, 3)).toBe(14);
  });

  it("stops falling far higher than damage does, so a reaction stays visible", () => {
    expect(hitstunScale(10)).toBeCloseTo(0.5);
    expect(hitstunScale(100)).toBeCloseTo(0.5);
    // Three or four frames is what the damage floor would have left of an 18
    // frame reaction — a flicker rather than a pose.
    expect(scaledHitstun(18, 100)).toBe(9);
  });

  it("leaves a blow authored to hold nothing alone", () => {
    expect(scaledHitstun(0, 0)).toBe(0);
    expect(scaledHitstun(0, 9)).toBe(0);
  });

  it("ends the jab's link into itself instead of letting it run forever", () => {
    // Measured 2026-08-16: the jab recovers 9 frames after it lands and needs 5
    // frames of advantage to reach with the next one — four of start-up plus the
    // frame it connects on.
    const advantage = (hits: number) => scaledHitstun(17, hits) - 9;
    expect(advantage(0)).toBeGreaterThanOrEqual(5);
    expect(advantage(2)).toBeGreaterThanOrEqual(5);
    // The fourth jab arrives too late: the defender is standing before it lands.
    expect(advantage(3)).toBeLessThan(5);
  });

  it("makes a long combo worth visibly less than a short one", () => {
    // The measured combo from a recording — uppercut into the medium string —
    // which took 78 of 100 health before any of this existed.
    const blows = [14, 7, 8, 9, 14, 12, 14];
    const before = blows.reduce((t, d) => t + d, 0);
    const after = blows.reduce((t, d, i) => t + scaledDamage(d, i), 0);
    expect(before).toBe(78);
    expect(after).toBeLessThan(before * 0.8);
  });
});
