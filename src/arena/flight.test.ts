import { describe, expect, it } from "vitest";
import { flightPlan } from "./flight";

describe("flightPlan", () => {
  it("flies him off sideways at 8 a frame, from where the tournament's a0 left him to x 440, as recorded", () => {
    const plan = flightPlan("side", false, { x: 192, y: 200 });
    const away = plan.filter((f) => !f.blank);
    expect(away).toHaveLength(32);
    expect(away[0].defender).toEqual({ x: 192, y: 200 });
    expect(away.at(-1)!.defender).toEqual({ x: 440, y: 200 });
  });

  it("brings him back in from the side he left by, to hang at 192 for 40 frames before he falls", () => {
    const plan = flightPlan("side", false, { x: 192, y: 200 });
    const shown = plan.filter((f) => f.blank && f.defender);
    expect(shown[0].defender!.x).toBe(-56);
    expect(shown.filter((f) => f.defender!.x === 192)).toHaveLength(41);
    // the blow at f82, the old arena gone at f114, him back at f167 and down at f239
    expect(plan).toHaveLength(239 - 82);
  });

  it("mirrors it all for a blow sent leftward, to hang at 64", () => {
    const plan = flightPlan("side", true, { x: 64, y: 200 });
    expect(plan.filter((f) => !f.blank)[1].defender!.x).toBe(56);
    expect(plan.at(-1)!.defender!.x).toBe(64);
  });

  it("flies up or down off the screen and shows nothing more: the new arena takes him from there", () => {
    const up = flightPlan("up", false, { x: 192, y: 200 });
    expect(up.filter((f) => !f.blank)[1].defender).toEqual({ x: 192, y: 192 });
    expect(up.at(-1)).toEqual({ defender: null, blank: true });
    const down = flightPlan("down", false, { x: 192, y: 200 });
    expect(down.filter((f) => !f.blank)[1].defender!.y).toBe(208);
  });
});
