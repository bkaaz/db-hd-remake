import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { objectEntry, objectFacts } from "./objectCode";

describe.skipIf(!existsSync(ROM_PATH))("objectFacts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const at = (type: number, anim: number, what: string) => objectFacts(rom, type, anim).filter((f) => f.what === what);

  it("finds the ki blast's type in the table by type", () => {
    expect(objectEntry(rom, 0x0a)).toBe(0x0fe0d7);
  });

  it("reads the ki blast: gone after 53 frames out of hitstop, its frame flipped every 2nd frame of the game", () => {
    expect(at(0x0a, 0x03, "is gone").map((f) => f.from)).toContain(53);
    expect(at(0x0a, 0x03, "changes the frame shown")[0].when).toContain("every 2nd frame of the game");
  });

  it("reads the dust: a step every 6 frames, gone at its 4th", () => {
    expect(at(0x0a, 0x0d, "shows its next frame").map((f) => f.from)).toEqual([6]);
    expect(at(0x0a, 0x0d, "is gone").some((f) => f.when?.includes("when field 02 (frame shown) is 04 or more"))).toBe(true);
  });

  it("reads the Kamehameha's base looping back to its frame 2 while its band is drawn", () => {
    const loop = at(0x0a, 0x16, "shows frame 2");
    expect(loop.map((f) => f.when?.at(-1))).toEqual(["when field 02 (frame shown) is 05 or more", "when field 02 (frame shown) is 05 or more"]);
    expect(at(0x0a, 0x16, "shows its next frame").map((f) => f.from)).toEqual([4]);
  });
});
