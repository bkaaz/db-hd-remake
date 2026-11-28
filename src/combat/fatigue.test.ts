import { describe, expect, it } from "vitest";
import { Fatigue, FATIGUE_FULL, PER_HIT } from "./fatigue";

describe("fatigue", () => {
  it("is spent by the twentieth hit, and starts again from nothing", () => {
    const f = new Fatigue();
    for (let i = 1; i < 20; i++) expect(f.hit()).toBe(false);
    expect(f.fraction).toBe(19 / 20);
    expect(f.hit()).toBe(true);
    expect(f.fraction).toBe(0);
  });

  it("takes points of its own beside a hit's, spent once they fill it", () => {
    const f = new Fatigue();
    expect(f.add(25)).toBe(false);
    expect(f.fraction).toBe(25 / FATIGUE_FULL);
    for (let i = 0; i < (FATIGUE_FULL - 25) / PER_HIT - 1; i++) expect(f.hit()).toBe(false);
    expect(f.add(15)).toBe(true);
    expect(f.fraction).toBe(0);
  });
});
