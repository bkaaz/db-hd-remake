import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { holdOffsets } from "./hold";

describe.skipIf(!existsSync(ROM_PATH))("holdOffsets, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads where the throw holds each opponent, by the thrower's step", () => {
    expect(holdOffsets(rom, 0x2082a5, 0, 3)).toEqual([[24, 0], [22, 0], [-32, -32]]);
    expect(holdOffsets(rom, 0x2082a5, 1, 3)).toEqual([[38, 0], [36, 0], [8, -16]]);
  });
});
