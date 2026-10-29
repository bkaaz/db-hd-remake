import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { closeLines } from "./buttons";

describe.skipIf(!existsSync(ROM_PATH))("closeLines, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads Goku's: close Y under 44 px, close B under 48", () => {
    // Recorded 2026-10-29: close Y at 41 px and nearer, far Y from 53.
    expect(closeLines(rom, 0)).toEqual({ y: 44, b: 48 });
  });

  it("is what goku's attributes copied, Y as attack and B as smash", () => {
    const { closeRange } = JSON.parse(readFileSync("data/entities/goku/attributes.json", "utf8"));
    const { y, b } = closeLines(rom, 0);
    expect(closeRange).toEqual({ attack: y, smash: b });
  });
});
