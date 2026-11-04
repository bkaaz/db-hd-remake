import { describe, expect, it } from "vitest";
import { padFrames, runTable } from "./run";

describe("padFrames", () => {
  it("spells a script's tokens as the pad's bits, a press held for its step", () => {
    expect(padFrames({ does: ["down 1", "fwd attack 2", "back blast", 1] }, 5)).toEqual([
      { high: 0x04, low: 0, dir: 0 },
      { high: 0x40, low: 0, dir: 1 },
      { high: 0x40, low: 0, dir: 1 },
      { high: 0, low: 0x80, dir: -1 },
      { high: 0, low: 0, dir: 0 },
    ]);
  });

  it("does nothing past its end, and nothing with no script", () => {
    expect(padFrames({ does: ["up"] }, 2)).toEqual([{ high: 0x08, low: 0, dir: 0 }, { high: 0, low: 0, dir: 0 }]);
    expect(padFrames(undefined, 1)).toEqual([{ high: 0, low: 0, dir: 0 }]);
  });

  it("says what is wrong with a script", () => {
    expect(padFrames({ does: ["kick"] }, 1)).toMatch(/kick/);
  });
});

describe("runTable", () => {
  it("writes the Lua table run.lua reads, health only where the scenario sets it", () => {
    const lua = runTable({ state: "a", frames: 1, hp1: 80, shots: [1], p1: { does: ["attack"] } }, { state: "/s.mss", out: "/o.txt", shots: "/r" });
    expect(lua).toBe(`RUN = { state = "/s.mss", out = "/o.txt", shotsAt = "/r", shots = {[1]=true}, frames = 1, free = false, health = {[1]=80}, pads = { {{64,0,0}}, {{0,0,0}} } }\n`);
  });
});
