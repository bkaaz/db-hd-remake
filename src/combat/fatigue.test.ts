import { describe, expect, it } from "vitest";
import { Fatigue, FATIGUE_HITS } from "./fatigue";

describe("fatigue", () => {
  it("is spent by the last of its hits, and starts again from nothing", () => {
    const f = new Fatigue();
    for (let i = 1; i < FATIGUE_HITS; i++) expect(f.hit()).toBe(false);
    expect(f.fraction).toBe((FATIGUE_HITS - 1) / FATIGUE_HITS);
    expect(f.hit()).toBe(true);
    expect(f.fraction).toBe(0);
  });
});
