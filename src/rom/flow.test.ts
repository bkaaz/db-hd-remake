import { describe, expect, it } from "vitest";
import { START, type Cpu, type Test } from "./cpu";
import { CHARACTER, FRAMES, ways, type Known } from "./flow";

const k: Known = { frame: null };
const cpu = (source: Cpu["source"], test: Test): Cpu => ({ ...START, source, test });
const onFrames = (value: number) => cpu({ field: FRAMES, who: "mover" }, { op: "cmp", value });
const onA = (value: number) => cpu(null, { op: "cmp", value });

describe("ways", () => {
  it("pins the frame where a BEQ is taken and a BNE falls through", () => {
    expect(ways("BEQ", k, onFrames(2), null)).toEqual([{ frame: 2 }, k]);
    expect(ways("BNE", k, onFrames(2), null)).toEqual([k, { frame: 2 }]);
  });

  it("bounds it where a BCS is taken and a BCC falls through", () => {
    expect(ways("BCS", k, onFrames(0x34), null)).toEqual([{ frame: null, from: 0x34 }, k]);
    expect(ways("BCC", { frame: null, from: 0x2b }, onFrames(0x34), null)).toEqual([{ frame: null, from: 0x2b }, { frame: null, from: 0x34 }]);
  });

  it("never runs a way the frame already known rules out", () => {
    expect(ways("BCC", { frame: 1 }, onFrames(0x14), null)).toEqual([{ frame: 1 }, null]);
    expect(ways("BEQ", { frame: 1 }, onFrames(2), null)).toEqual([null, { frame: 1 }]);
    expect(ways("BCC", { frame: null, from: 0x34 }, onFrames(0x14), null)).toEqual([null, { frame: null, from: 0x34 }]);
  });

  it("adds the answer a routine gave in the carry to what each way waits on", () => {
    const asked = { set: "once it has landed", clear: "until it lands" };
    expect(ways("BCC", { frame: null, when: ["while A held"] }, cpu(null, { op: "zero" }), asked)).toEqual([
      { frame: null, when: ["while A held", "until it lands"] },
      { frame: null, when: ["while A held", "once it has landed"] },
    ]);
  });

  it("narrows what A can be on a compare with a constant, and drops a way none of it takes", () => {
    expect(ways("BCC", k, onA(0xfe00), null)).toEqual([{ frame: null, range: [0, 0xfdff] }, { frame: null, range: [0xfe00, 0xffff] }]);
    // $0D:EC12: vy already capped at -2.0, so the second compare always branches
    expect(ways("BCC", { frame: null, range: [0xfe00, 0xfe00] }, onA(0xfe01), null)).toEqual([{ frame: null, range: [0xfe00, 0xfe00] }, null]);
    expect(ways("BNE", { frame: null, range: [3, 3] }, onA(3), null)).toEqual([null, { frame: null, range: [3, 3] }]);
  });

  it("follows only the way a known character goes", () => {
    const buu = cpu({ field: CHARACTER, who: "mover" }, { op: "cmp", value: 9 });
    expect(ways("BEQ", k, buu, null, 9)).toEqual([k, null]);
    expect(ways("BEQ", k, buu, null, 0)).toEqual([null, k]);
  });

  it("lets a test the path has already answered settle the branch", () => {
    const f0 = cpu({ field: 0xf0, who: "mover" }, { op: "zero" });
    expect(ways("BEQ", { frame: null, when: ["when field f0 is not 0"] }, f0, null)).toEqual([null, { frame: null, when: ["when field f0 is not 0"] }]);
    expect(ways("BEQ", { frame: null, when: ["when field f0 is 0"] }, f0, null)).toEqual([{ frame: null, when: ["when field f0 is 0"] }, null]);
  });

  it("names a test on any other field in each way's conditions", () => {
    expect(ways("BEQ", k, cpu({ field: 0xf0, who: "mover" }, { op: "zero" }), null)).toEqual([
      { frame: null, when: ["when field f0 is 0"] },
      { frame: null, when: ["when field f0 is not 0"] },
    ]);
  });
});
