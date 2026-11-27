import { describe, expect, it } from "vitest";
import { NO_ASK, stunAfter } from "./stunHold";

describe("stunAfter", () => {
  it("counts down a frame when nothing is asked", () => {
    expect(stunAfter(10, NO_ASK)).toBe(9);
  });

  it("stands still while a combo's charge holds it", () => {
    expect(stunAfter(3, { hold: true, atLeast: 0 })).toBe(3);
  });

  it("is topped up to what the second level leaves him, then counts on", () => {
    expect(stunAfter(2, { hold: false, atLeast: 12 })).toBe(11);
    // more than that left is left alone
    expect(stunAfter(30, { hold: false, atLeast: 12 })).toBe(29);
  });

  it("never stuns one already free", () => {
    expect([stunAfter(0, { hold: true, atLeast: 12 }), stunAfter(0, NO_ASK)]).toEqual([0, 0]);
  });
});
