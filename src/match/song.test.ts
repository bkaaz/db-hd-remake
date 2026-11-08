import { describe, expect, it } from "vitest";
import { fightSong, randomSong, readSongPick } from "./song";

describe("a fight's song", () => {
  it("is 1 to 9 by the random byte's low bits, 2 to 8 twice as often", () => {
    const counts = new Map<number, number>();
    for (let byte = 0; byte < 16; byte++) counts.set(randomSong(byte), (counts.get(randomSong(byte)) ?? 0) + 1);
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([counts.get(1), counts.get(5), counts.get(9)]).toEqual([1, 2, 1]);
  });

  it("reads only the low four bits", () => {
    expect(randomSong(0xf9)).toBe(randomSong(0x09));
    expect(randomSong(0x09)).toBe(2);
  });

  it("is the one picked, when one is, and none when none is", () => {
    expect(fightSong(14, () => 0)).toBe(14);
    expect(fightSong("none", () => 0)).toBe(null);
    expect(fightSong("random", () => 0)).toBe(1);
  });

  it("comes back as it was kept, and random when what was kept does not read", () => {
    expect([readSongPick("5"), readSongPick("none"), readSongPick("random")]).toEqual([5, "none", "random"]);
    expect([readSongPick(null), readSongPick("0"), readSongPick("loud")]).toEqual(["random", "random", "random"]);
  });
});
