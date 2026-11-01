import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { ownMoves } from "./ownMoves";

describe.skipIf(!existsSync(ROM_PATH))("ownMoves, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const goku = ownMoves(rom, GOKU);

  it("takes what the command table picks", () => {
    expect(goku.has(0xa5)).toBe(true);
  });

  it("takes the attacks a special's handler goes on to", () => {
    // Slash Down Kick's somersault; Saiyan Meteor's follow-up
    expect(goku.has(0xb1)).toBe(true);
    expect(goku.has(0xae)).toBe(true);
  });

  it("leaves what everyone plays: landing, a jump's fall, the opponent's hold", () => {
    for (const shared of [0x3b, 0x05, 0x30]) expect(goku.has(shared)).toBe(false);
  });
});
