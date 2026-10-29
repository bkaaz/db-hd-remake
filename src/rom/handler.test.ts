import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { handlerAt, handlerFacts } from "./handler";

describe.skipIf(!existsSync(ROM_PATH))("handlerFacts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const quad = handlerFacts(rom, handlerAt(rom, GOKU.character, 0xa5));

  it("finds Quadruple Kick's handler, apart from the normals' shared one", () => {
    expect(handlerAt(rom, GOKU.character, 0xa5)).toBe(0x208663);
    expect(handlerAt(rom, GOKU.character, 0x92)).toBe(0x0faa54);
  });

  it("reads the speeds it walks forward with, frame by frame", () => {
    const speeds = quad.filter((f) => f.vx !== undefined).map((f) => [f.frame, f.vx]);
    expect(speeds).toEqual([
      [0x0e, 2.375], [0x12, 1.25], [0x1a, 2.375], [0x20, 1.25],
      [0x30, 2.375], [0x36, 1.25], [0x46, 2.375], [0x4c, 1.25],
    ]);
  });

  it("reads where it re-arms the blow, and that frame 0 ends the move", () => {
    expect(quad.filter((f) => f.what === "re-arms the blow").map((f) => f.frame)).toEqual([0x1a, 0x30, 0x46]);
    expect(quad.find((f) => f.what === "ends the move")?.frame).toBe(0);
  });
});
