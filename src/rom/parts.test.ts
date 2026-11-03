import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { moveParts } from "./parts";

describe.skipIf(!existsSync(ROM_PATH))("moveParts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("cuts pinned (4a) where each fall lands: its fall, its bounce, then lying", () => {
    expect(moveParts(rom, GOKU, 0x4a).parts.map((p) => [p.anim, p.from])).toEqual([
      ["m4a", 0],
      ["m4a_2", 24],
      ["m4a_3", 32],
    ]);
  });
});
