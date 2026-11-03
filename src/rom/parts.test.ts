import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { moveParts } from "./parts";
import { fighterNamed } from "./roster";

describe.skipIf(!existsSync(ROM_PATH))("moveParts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("cuts pinned (4a) where each fall lands: its fall, its bounce, then lying", () => {
    expect(moveParts(rom, GOKU, 0x4a).parts.map((p) => [p.anim, p.from])).toEqual([
      ["m4a", 0],
      ["m4a_2", 24],
      ["m4a_3", 32],
    ]);
  });

  const vegeta = fighterNamed(rom, "vegeta");
  const starts = (move: number) => moveParts(rom, vegeta, move).parts.map((p) => p.from);

  it("cuts where blows start or stop passing him by: Jumping Bomb's 16, Energy Dash's 28", () => {
    expect(starts(0x9e)).toEqual([0, 16, 26]);
    expect(starts(0xa7)).toEqual([0, 28]);
  });

  it("cuts where a handler running by frame jumps to a step of its own: Vertical Ki's landing at 56", () => {
    expect(starts(0xb1).at(-1)).toBe(56);
  });
});
