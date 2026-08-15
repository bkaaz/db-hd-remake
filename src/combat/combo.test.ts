import { describe, expect, it } from "vitest";
import { Combo, SMASH_LIMIT } from "./combo";

describe("Combo", () => {
  it("starts at nothing", () => {
    const c = new Combo();
    expect(c.hits).toBe(0);
    expect(c.damage).toBe(0);
  });

  it("counts blows and what they cost", () => {
    const c = new Combo();
    c.hit(7);
    c.hit(9);
    expect(c.hits).toBe(2);
    expect(c.damage).toBe(16);
  });

  it("keeps counting while the fighter stays in reactions", () => {
    const c = new Combo();
    c.hit(7);
    c.enter(1); // flinch
    c.hit(9);
    c.enter(2); // stagger
    c.hit(10);
    c.enter(3); // knockdown
    expect(c.hits).toBe(3);
    expect(c.damage).toBe(26);
  });

  it("resets the moment the fighter has control again", () => {
    const c = new Combo();
    c.hit(7);
    c.hit(9);
    c.enter(0); // idle, or an attack of their own
    expect(c.hits).toBe(0);
    expect(c.damage).toBe(0);
  });

  describe("the smash limit", () => {
    it("allows a lift while there is budget left", () => {
      expect(new Combo().smashable).toBe(true);
    });

    it("stops allowing them at the limit", () => {
      const c = new Combo();
      for (let i = 0; i < SMASH_LIMIT; i++) {
        expect(c.smashable).toBe(true);
        c.smash();
      }
      expect(c.smashable).toBe(false);
      expect(c.lifts).toBe(SMASH_LIMIT);
    });

    it("is the uppercut loop that it closes", () => {
      // Rank alone cannot: a knockdown replacing a knockdown is an equal rank,
      // which is exactly what a combo is allowed to do.
      const c = new Combo();
      const uppercut = (): boolean => {
        if (!c.smashable) return false;
        c.smash();
        c.hit(14);
        c.enter(3);
        return true;
      };
      for (let i = 0; i < SMASH_LIMIT; i++) expect(uppercut()).toBe(true);
      expect(uppercut()).toBe(false);
    });

    it("hands the budget back when the fighter has control again", () => {
      const c = new Combo();
      for (let i = 0; i < SMASH_LIMIT; i++) c.smash();
      c.enter(0);
      expect(c.lifts).toBe(0);
      expect(c.smashable).toBe(true);
    });

    it("keeps the budget spent while the fighter stays helpless", () => {
      const c = new Combo();
      c.smash();
      c.enter(3); // knocked down
      c.enter(4); // and now on the floor
      expect(c.lifts).toBe(1);
    });
  });

  it("counts a blow that lands without interrupting", () => {
    // A jab at someone already being knocked down is refused a reaction, so no
    // state is entered at all — but it hit, and the combo is one longer.
    const c = new Combo();
    c.enter(3);
    c.hit(6);
    expect(c.hits).toBe(1);
    expect(c.damage).toBe(6);
  });
});
