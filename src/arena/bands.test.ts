import { describe, expect, it } from "vitest";
import { BandClock, bandScreen, BAND_TABLES } from "./bands";

describe("BandClock", () => {
  it("steps through the way's four tables, the first last, turning them inside out each time it comes round", () => {
    const clock = new BandClock(false);
    const shown = Array.from({ length: 8 }, () => clock.next());
    expect(shown).toEqual([
      bandScreen(false, 1, false),
      bandScreen(false, 2, false),
      bandScreen(false, 3, false),
      bandScreen(false, 0, true),
      bandScreen(false, 1, true),
      bandScreen(false, 2, true),
      bandScreen(false, 3, true),
      bandScreen(false, 0, false),
    ]);
  });

  it("keeps the two ways' screens apart", () => {
    const clock = new BandClock(true);
    const left = new Set(Array.from({ length: 8 }, () => clock.next()));
    for (const screen of left) expect(screen).toBeLessThan(BAND_TABLES * 2);
  });
});
