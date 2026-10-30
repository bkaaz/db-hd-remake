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
      { op: "sound", id: 0x32 },
      { op: "voice", id: 0x07 },
    ]);
  });

  it("reads an offset as two signed words of pixels", () => {
    expect(at0(0xd0, 0x08, 0x00, 0xd0, 0xff, 0x00)).toEqual([{ op: "offset", dx: 8, dy: -48 }]);
  });

  it("reads b0 as a spawn: type, animation, tile base, palette and position", () => {
    // ki: type a, animation 3, 40 px ahead and 56 up; hair: base 0x8800 words
    const ki = [0xb0, 0x00, 0xca, 0x03, 0x00, 0x00, 0x04, 0x28, 0x00, 0xc8, 0xff, 0, 0, 3, 0, 0];
    const hair = [0xb0, 0x00, 0x80, 0x05, 0x00, 0x88, 0x88, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(at0(...ki, ...hair, 0x00)).toEqual([
      { op: "spawn", counter: 0, type: 0xa, anim: 3, tiles: 0, palette: 2, dx: 40, dy: -56 },
      { op: "spawn", counter: 0, type: 0, anim: 5, tiles: 0x80, palette: 4, dx: 0, dy: 0 },
    ]);
  });

  it("reads e0 as a flip of the whole drawing, by OAM's bits", () => {
    expect(at0(0xe0, 0xc0, 0xe0, 0x40, 0x00)).toEqual([
      { op: "flip", h: true, v: true },
      { op: "flip", h: true, v: false },
    ]);
  });

  it("keeps a command it cannot interpret whole, at the length the engine skips", () => {
    const ops = at0(0xe0, 0x01, 0x04, 0x4c, 0x00, 0x00);
    expect(ops[0]).toEqual({ op: "raw", bytes: [0xe0, 0x01] });
    expect(ops[1]).toEqual({ op: "show", frames: 4, drawing: 0x4c });
  });

  it("refuses a command whose length is not known", () => {
    expect(() => at0(0x85, 0x00)).toThrow(/not read yet/);
  });

  it("reads c0 as field 0x96, 90 as a stop and b1 as a drawn effect with its counter", () => {
    const ops = at0(0xc0, 0x70, 0x90, 0xb1, 0x01, 0x02, 0xf6, 0xff, 0xda, 0xff, 0x04, 0x20, 0x00);
    expect(ops).toEqual([
      { op: "field96", value: 0x70 },
      { op: "stop" },
      { op: "effect", counter: 1, kind: 2, dx: -10, dy: -38, size: 4, param: 0x20 },
    ]);
  });

  it("reads the opponent's track in step with the script, by character", () => {
    // a script at 0x8000 of its bank: 80 and ten pointers, then c0 70 and a step;
    // character 0's track at 0x8040 lines up its drawing word 0x15 bytes behind
    const rom = new Uint8Array(0x10000);
    const base = 0x8000;
    rom.set([0x80], base);
    for (let c = 0; c < 10; c++) rom.set([0x40 + 8 * c, 0x80], base + 1 + 2 * c);
    rom.set([0xc0, 0x70, 0x0a, 0x69, 0x00, 0x00], base + 0x15);
    // the step's drawing word is at script offset 0x18 → track offset 3
    rom.set([0x17, 0x00], base + 0x40 + 3);
    rom.set([0xee, 0xee], base + 0x48 + 3);
    const ops = readScript(rom, base);
    expect(ops[0]).toMatchObject({ op: "opponent" });
    const step = ops.find((o) => o.op === "show");
    expect(step).toMatchObject({ frames: 10, drawing: 0x69 });
    expect(step?.op === "show" && step.opponent?.slice(0, 2)).toEqual([0x17, null]);
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

  it("reads the throw's opponent track: Goku thrown shows 17, 18, 20 as the thrower shows 69, 6a, 6b", () => {
    const steps = readScript(rom, scriptAt(rom, GOKU, 0x9d)).filter((o) => o.op === "show");
    expect(steps.map((s) => s.op === "show" && [s.drawing, s.opponent?.[0]])).toEqual([
      [0x69, 0x17],
      [0x6a, 0x18],
      [0x6b, 0x20],
    ]);
  });
});
