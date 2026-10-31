import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH, scriptAt } from "./cartridge";
import { fallAfterJumpAttack, fallStep, JUMP } from "./fall";
import { readScript, type ScriptOp } from "./script";

const show = (frames: number): ScriptOp => ({ op: "show", frames, drawing: 1 });

describe("fallStep", () => {
  it("keeps the step while the frame is inside it", () => {
    expect(fallStep([show(2), show(13), show(4)], { step: 1, frame: 10 })).toBe(1);
  });

  it("steps on while the frame lies past the step's end", () => {
    expect(fallStep([show(2), show(13), show(4), { op: "hold", drawing: 7 }], { step: 1, frame: 20 })).toBe(3);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("fallAfterJumpAttack, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads every fighter's step and frame", () => {
    expect(fallAfterJumpAttack(rom, 0)).toEqual({ step: 4, frame: 0x22 });
    expect(fallAfterJumpAttack(rom, 1)).toEqual({ step: 2, frame: 0x1c });
    for (let character = 0; character < 10; character++) expect(() => fallAfterJumpAttack(rom, character)).not.toThrow();
  });

  it("lands Goku on his jump's last pose, the fall", () => {
    const ops = readScript(rom, scriptAt(rom, GOKU, JUMP));
    expect(fallStep(ops, fallAfterJumpAttack(rom, 0))).toBe(5);
  });
});
