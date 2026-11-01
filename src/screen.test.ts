import { describe, expect, it } from "vitest";
import { cue, LIT, tick, type Screen } from "./screen";

const run = (s: Screen, frames: number): Screen => Array.from({ length: frames }).reduce<Screen>((a) => tick(a), s);

describe("screen", () => {
  it("dims a sixteenth a frame down to 6 and stays there", () => {
    const dimming = cue(LIT, "dim");
    expect(tick(dimming).level).toBe(15);
    expect(run(dimming, 10).level).toBe(6);
    expect(run(dimming, 30).level).toBe(6);
  });

  it("comes back up to full the same way", () => {
    const dim = run(cue(LIT, "dim"), 10);
    expect(run(cue(dim, "bright"), 10).level).toBe(16);
  });

  it("holds white until restored, whatever the level does", () => {
    const white = cue(LIT, "white");
    expect(white.white).toBe(true);
    expect(cue(white, "restore").white).toBe(false);
  });
});
