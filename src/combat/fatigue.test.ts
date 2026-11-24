import { describe, expect, it } from "vitest";
import { Fatigue, FATIGUE_MAX } from "./fatigue";

describe("fatigue", () => {
  it("fills with what blows add, and is spent only past the full amount", () => {
    const f = new Fatigue();
    expect(f.take(FATIGUE_MAX)).toBe(false);
    expect(f.fraction).toBe(1);
    expect(f.take(1)).toBe(true);
    expect(f.fraction).toBe(0);
  });
});
