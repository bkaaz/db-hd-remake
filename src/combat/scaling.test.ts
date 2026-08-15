import { describe, expect, it } from "vitest";
import { damageScale, scaledDamage } from "./scaling";

describe("damage scaling", () => {
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
