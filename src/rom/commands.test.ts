import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { arrow, buttonName, readCommands } from "./commands";

describe("buttonName", () => {
  it("names the button, and a direction only when the command wants it held", () => {
    expect(buttonName(0x8002)).toBe("B");
    expect(buttonName(0x8108)).toBe("→ + B");
    expect(buttonName(0x0082)).toBe("A");
    expect(buttonName(0x9010)).toBe("L or R + B");
  });
});

describe.skipIf(!existsSync(ROM_PATH))("readCommands, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const goku = readCommands(rom, GOKU.character);
  const input = (move: number) => {
    const c = goku.find((x) => x.move === move);
    return c && [...c.directions.map(arrow), buttonName(c.button)].join(" ");
  };

  it("reads Quadruple Kick as a half circle forward and B, oldest first", () => {
    expect(input(0xa5)).toBe("← ↙ ↓ ↘ → B");
  });

  it("reads the Kamehameha on A and Double Kick as → held with B", () => {
    expect(input(0xab)).toBe("← ↙ ↓ ↘ → A");
    expect(input(0xa2)).toBe("→ + B");
  });

  it("finds Slash Down Kick in the air and nowhere else", () => {
    expect(goku.filter((c) => c.move === 0xac).map((c) => c.where)).toEqual(["air"]);
  });
});
