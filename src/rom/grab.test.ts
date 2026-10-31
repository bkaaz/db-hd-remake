import { describe, expect, it } from "vitest";
import { grabOf } from "./grab";
import type { PortReport } from "./port";

describe("grabOf", () => {
  it("holds each opponent by his name and throws him backwards, facing the thrower's way", () => {
    const report = {
      holds: [{ against: "goku", at: [[24, 0]] }],
      launch: { frame: 20, damage: 40, stun: 3, move: 0x1b, vx: 2.5, vy: -8, facing: { field: 0x12, who: "mover", eor: 0x40 } },
    } as unknown as PortReport;
    expect(grabOf(report, "reel_down")).toEqual({
      at: { goku: [[24, 0]] },
      launch: { frame: 20, damage: 40, reaction: "reel_down", vel: [-2.5, -8] },
    });
    expect(grabOf({ holds: [] } as unknown as PortReport, "x")).toBeNull();
  });
});
