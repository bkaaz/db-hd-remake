import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH, scriptAt } from "./cartridge";
import { readScript } from "./script";

const at0 = (...bytes: number[]) => readScript(Uint8Array.from(bytes), 0);

describe("readScript", () => {
  it("reads steps as frames and a 16-bit drawing, up to 00", () => {
    expect(at0(0x08, 0x46, 0x00, 0x10, 0x2c, 0x01, 0x00)).toEqual([
      { op: "show", frames: 8, drawing: 0x46 },
      { op: "show", frames: 16, drawing: 0x12c },
    ]);
  });

  it("reads drawing EEEE as keeping the one that is up", () => {
    expect(at0(0x02, 0xee, 0xee, 0x00)).toEqual([{ op: "show", frames: 2, drawing: null }]);
  });

  it("takes the id of a0 / a1 from the third byte, not the counter in the second", () => {
    expect(at0(0xa0, 0x01, 0x32, 0xa1, 0x00, 0x07, 0x00)).toEqual([
      { op: "attack", id: 0x32 },
      { op: "effect", id: 0x07 },
    ]);
  });

  it("reads a velocity as two signed words", () => {
    expect(at0(0xd0, 0x00, 0xfe, 0x80, 0x01, 0x00)).toEqual([{ op: "velocity", vx: -512, vy: 384 }]);
  });

  it("keeps a command it cannot interpret whole, at the length the engine skips", () => {
    const ops = at0(0xc0, 0x20, 0x04, 0x4c, 0x00, 0x00);
    expect(ops[0]).toEqual({ op: "raw", bytes: [0xc0, 0x20] });
    expect(ops[1]).toEqual({ op: "show", frames: 4, drawing: 0x4c });
  });

  it("refuses a command whose length is not known", () => {
    expect(() => at0(0x80, 0x00)).toThrow(/not read yet/);
  });
});

// Recorded in Mesen on 2026-10-28: far Y held 46, 4a, 4a, 46 after 2 frames of
// the idle drawing, and the whole move took 38 frames.
describe.skipIf(!existsSync(ROM_PATH))("readScript, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("finds Goku's close Y, far Y and X where the recordings put them", () => {
    expect([0x90, 0x92, 0x9a].map((m) => scriptAt(rom, GOKU, m))).toEqual([0x632ae, 0x632cf, 0x63361]);
  });

  it("reads far Y as the recording saw it", () => {
    const steps = readScript(rom, scriptAt(rom, GOKU, 0x92)).filter((op) => op.op === "show");
    expect(steps.map((s) => [s.frames, s.drawing])).toEqual([
      [2, null], [8, 0x46], [8, 0x4a], [4, 0x4a], [16, 0x46],
    ]);
  });
});
