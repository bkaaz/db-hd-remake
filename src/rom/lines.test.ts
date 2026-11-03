import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { spokenLines } from "./lines";
import { fighterNamed } from "./roster";

describe.skipIf(!existsSync(ROM_PATH))("spoken lines from the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("finds the lines a fighter's scripts speak: Vegeta's Final Flash is 0d", () => {
    expect(spokenLines(rom, fighterNamed(rom, "vegeta"))).toContain(0x0d);
  });
});
