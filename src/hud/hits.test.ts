import { describe, expect, it } from "vitest";
import { FROM_HITS, HitCounter, HOLD } from "./hits";

describe("the hit counter", () => {
  it("shows a combo from its second hit, not its first", () => {
    const c = new HitCounter();
    c.tick(FROM_HITS - 1, 20);
    expect(c.shown).toBeNull();
    c.tick(FROM_HITS, 45);
    expect(c.shown).toEqual({ hits: FROM_HITS, damage: 45 });
  });

  it("keeps the last combo a while after it ends, then lets it go", () => {
    const c = new HitCounter();
    c.tick(5, 120);
    for (let i = 0; i < HOLD; i++) c.tick(0, 0);
    expect(c.shown).toEqual({ hits: 5, damage: 120 });
    c.tick(0, 0);
    expect(c.shown).toBeNull();
  });
});
