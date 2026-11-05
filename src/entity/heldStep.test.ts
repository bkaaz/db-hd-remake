import { describe, expect, it } from "vitest";
import type { StateDef } from "./states";
import { staysOnStep } from "./heldStep";

const POSE: StateDef = { anim: "pose", holdStep: 2, transitions: [] };

describe("staysOnStep", () => {
  it("holds only the named step, for as long as the state lasts", () => {
    expect(staysOnStep(POSE, 2, 9999)).toBe(true);
    expect(staysOnStep(POSE, 1, 1)).toBe(false);
    expect(staysOnStep({ ...POSE, holdStep: undefined }, 2, 1)).toBe(false);
    expect(staysOnStep(undefined, 0, 1)).toBe(false);
  });

  it("lets go on the frame `holdFrames` names, not before", () => {
    const rise = { ...POSE, holdFrames: 30 };
    expect(staysOnStep(rise, 2, 29)).toBe(true);
    expect(staysOnStep(rise, 2, 30)).toBe(false);
  });

  it("holds step 0 as any other", () => {
    expect(staysOnStep({ ...POSE, holdStep: 0 }, 0, 1)).toBe(true);
  });
});
