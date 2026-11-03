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

  it("throws him ahead, still facing the thrower, when the throw is given the thrower's own facing (Vegeta's)", () => {
    const report = {
      holds: [],
      launch: { frame: 102, damage: 40, stun: 4, move: 0x1b, vx: 2.5, vy: -8, facing: { field: 0x12, who: "mover" } },
    } as unknown as PortReport;
    expect(grabOf(report, "reel_down")?.launch).toEqual({ frame: 102, damage: 40, reaction: "reel_down", vel: [-2.5, -8], ahead: true });
  });
});
