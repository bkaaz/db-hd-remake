import { describe, expect, it } from "vitest";
import { Combo } from "./combo";

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
