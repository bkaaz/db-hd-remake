import { describe, expect, it } from "vitest";
import { describeFact } from "./describe";

describe("describeFact", () => {
  it("says whom it is done to and a facing as the code turns it", () => {
    expect(describeFact({ frame: 1, what: "sets the facing", who: "opponent", facing: { field: 0x12, who: "mover", eor: 0x40 } }))
      .toBe("the opponent faces the mover's way, turned");
  });

  it("puts what a fact waits on before it", () => {
    expect(describeFact({ frame: null, from: 52, when: ["when its object 0a/15 is gone"], what: "jumps to frame", to: 124 }))
      .toBe("from frame 52, when its object 0a/15 is gone: jumps to move frame 124");
  });
});
