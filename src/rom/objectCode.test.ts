import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { objectEntry, objectFacts } from "./objectCode";

describe.skipIf(!existsSync(ROM_PATH))("objectFacts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const at = (type: number, anim: number, what: string) => objectFacts(rom, type, anim).filter((f) => f.what.startsWith(what));

  it("finds the ki blast's type in the table by type", () => {
    expect(objectEntry(rom, 0x0a)).toBe(0x0fe0d7);
  });

  it("reads the ki blast: gone after 53 frames out of hitstop, its frame flipped every 2nd frame of the game", () => {
    expect(at(0x0a, 0x03, "is gone").map((f) => f.from)).toContain(53);
    expect(at(0x0a, 0x03, "changes the frame shown")[0].when).toContain("every 2nd frame of the game");
  });

  it("spells out how a frame is worked out: Freeza's Death Beam by the game's frame count, his ball from a table", () => {
    expect(at(0x06, 0x06, "changes the frame shown")[0].what).toContain("LDA $74 AND #8 LSR");
    expect(at(0x06, 0x11, "changes the frame shown")[0].what).toContain("LDA $fd3c2");
  });

  it("reads a palette run where the code works the record out, every 4th frame: the beams' base and heads, not the ki blast", () => {
    const run = (type: number, anim: number) => objectFacts(rom, type, anim).filter((f) => f.what.startsWith("loads a palette run"));
    expect(run(0x0a, 0x16)[0].when).toContain("every 4th frame of the game");
    expect(run(0x01, 0x0c)).toHaveLength(1);
    expect(run(0x0a, 0x03)).toEqual([]);
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

  it("reads Vegeta's Energy Field riding him 40 px up, playing 19, and testing that he is still in ab", () => {
    expect(at(0x01, 0x07, "stays on its thrower's x")).not.toHaveLength(0);
    expect(at(0x01, 0x07, "stays on its thrower's y, -40 px")).not.toHaveLength(0);
    expect(objectFacts(rom, 0x01, 0x07).some((f) => f.sound === 0x19)).toBe(true);
    expect(at(0x01, 0x07, "tests its thrower's move for ab")).not.toHaveLength(0);
  });

  it("reads his Ground Flare re-armed every 32nd frame of the game", () => {
    expect(at(0x01, 0x02, "re-arms its blow")[0].when).toContain("every 32nd frame of the game");
  });

  it("reads Vertical Ki becoming the explosion a/02 once its y is b8 or more", () => {
    const becomes = at(0x01, 0x06, "becomes 0a/02");
    expect(becomes.map((f) => f.when?.at(-1))).toEqual(["when field 09 (y) is b8 or more"]);
    expect(at(0x01, 0x06, "shows frame 0")).toHaveLength(0);
  });
});
