import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { handlerAt, handlerFacts, shakeOf } from "./handler";

describe("shakeOf", () => {
  it("reads $E3's pattern and frames, and nothing without bit 15", () => {
    expect(shakeOf(0x8108)).toEqual({ pattern: 1, frames: 8 });
    expect(shakeOf(0x0108)).toBeNull();
  });
});

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
    expect(down.find((f) => f.what === "bounces")).toMatchObject({ step: 1, when: ["once it has landed"] });
    // inside the bounce ($0D:EC12): $E3 = 8108, never the 8008 behind the capped speed
    expect(down.filter((f) => f.shake).map((f) => [f.step, f.when, f.shake])).toEqual([
      [1, ["once it has landed"], { pattern: 1, frames: 8 }],
    ]);
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
    const jumps = kame.filter((f) => f.to !== undefined && f.from === 52).map((f) => [f.to, f.when?.at(-1)]);
    expect(jumps.sort()).toEqual([
      [124, "when its object 0a/15 is gone"],
      [128, "when its object 0a/14 is gone"],
      [132, "when its object 0a/13 is gone"],
    ]);
  });

  it("follows code the roster shares only the way this fighter goes: charging's sound", () => {
    const charge = (character: number) =>
      handlerFacts(rom, handlerAt(rom, GOKU.character, 0x0c), 0, character).filter((f) => f.sound !== undefined).map((f) => f.sound);
    expect(charge(0)).toEqual([0x19]);
    expect(charge(8)).toEqual([0x46]);
  });

  it("reads the throw: the opponent's voice, its turns, the launch with its arguments, the hold", () => {
    const thrown = handlerFacts(rom, handlerAt(rom, GOKU.character, 0x9d), 3, GOKU.character);
    expect(thrown.find((f) => f.launch)).toMatchObject({
      frame: 20,
      launch: { damage: 40, stun: 3, move: 0x1b, vx: 2.5, vy: -8, facing: { field: 0x12, who: "mover", eor: 0x40 } },
    });
    expect(thrown.find((f) => f.sound === 0x30)).toMatchObject({ frame: 20, who: "opponent" });
    expect(thrown.filter((f) => f.facing).map((f) => [f.frame, f.who, f.facing])).toEqual([
      [1, "opponent", { field: 0x12, who: "mover", eor: 0x40 }],
      [21, "opponent", { field: 0x12, who: "mover" }],
    ]);
    expect(thrown.find((f) => f.hold)?.hold).toBe(0x2082a5);
  });

  it("reads the resources a move loads into OBJ VRAM, each player's place: the Kamehameha's 0x32", () => {
    const kame = handlerFacts(rom, handlerAt(rom, GOKU.character, 0xaa), 0, GOKU.character);
    expect(kame.filter((f) => f.load).map((f) => [f.frame, f.load])).toEqual([
      [2, { resource: 0x32, vram: 0x7c00 }],
      [2, { resource: 0x32, vram: 0x6c00 }],
    ]);
  });

  it("reads charging: its sound every 8th frame while B + Y are held, the loop back, the glow", () => {
    const charge = handlerFacts(rom, handlerAt(rom, GOKU.character, 0x0c), 0, GOKU.character);
    expect(charge.find((f) => f.sound === 0x19)?.when).toEqual(["when field f0 is 0", "while B + Y held", "every 8th frame of the game"]);
    expect(charge.find((f) => f.to === 6)?.when).toContain("when field 47 (step, a second count — with 0x46 at $01:86A7, alone at $01:86B2 ?) is 04");
    expect(charge.find((f) => f.frame === 2)?.what).toBe("loads its own palette + 8");
  });
});
