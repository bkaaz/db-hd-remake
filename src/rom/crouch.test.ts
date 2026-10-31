import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { crouchAfterAttack } from "./crouch";

describe.skipIf(!existsSync(ROM_PATH))("crouchAfterAttack, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads each fighter's frame from $0F:A124 — Goku's 6, two frames before the held crouch", () => {
    expect(crouchAfterAttack(rom, 0)).toBe(6);
    expect([...Array(8).keys()].map((c) => crouchAfterAttack(rom, c))).toEqual([6, 6, 6, 8, 6, 6, 6, 6]);
  });
});
