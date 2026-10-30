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

  it("reads the sounds a handler's own helpers play: the jump's landing", () => {
    const jump = handlerFacts(rom, handlerAt(rom, GOKU.character, 0x05));
    expect(jump.filter((f) => f.what === "plays sound").map((f) => f.sound)).toEqual([0x0c]);
  });

  it("reads a handler that jumps by step: the knockdown's fall, floor and lying", () => {
    const down = handlerFacts(rom, handlerAt(rom, GOKU.character, 0x1b), 5);
    const jumps = down.filter((f) => f.to !== undefined).map((f) => [f.step, f.to]);
    expect(jumps).toEqual([[0, 0x20], [1, 0x30], [1, 0x40], [2, 0x64], [3, 0x64]]);
    expect(down.filter((f) => f.what === "raises dust").map((f) => f.step)).toEqual([1, 2, 3]);
    expect(down.find((f) => f.what === "bounces")).toMatchObject({ step: 1, when: "once it has landed" });
    expect(down.find((f) => f.move !== undefined)).toMatchObject({ step: 4, move: 0x1f });
  });

  it("reads where it re-arms the blow, and that frame 0 ends the move", () => {
    expect(quad.filter((f) => f.what === "re-arms the blow").map((f) => f.frame)).toEqual([0x1a, 0x30, 0x46]);
    expect(quad.find((f) => f.what === "ends the move")?.frame).toBe(0);
    // the normals test the frame as a word: LDA $44,X / ORA $45,X
    const jab = handlerFacts(rom, handlerAt(rom, GOKU.character, 0x92));
    expect(jab.find((f) => f.what === "ends the move")?.frame).toBe(0);
  });

  it("reads the Kamehameha's jumps once its head is gone, by which head it looks for", () => {
    const kame = handlerFacts(rom, handlerAt(rom, GOKU.character, 0xaa));
    const jumps = kame.filter((f) => f.when !== undefined).map((f) => [f.from, f.when, f.to]);
    expect(jumps).toEqual([
      [52, "when its object 0a/15 is gone", 124],
      [52, "when its object 0a/13 is gone", 132],
      [52, "when its object 0a/14 is gone", 128],
    ]);
  });

  it("follows code the roster shares only the way this fighter goes: charging's sound", () => {
    const charge = (character: number) =>
      handlerFacts(rom, handlerAt(rom, GOKU.character, 0x0c), 0, character).filter((f) => f.sound !== undefined).map((f) => f.sound);
    expect(charge(0)).toEqual([0x19]);
    expect(charge(8)).toEqual([0x46]);
  });
});
