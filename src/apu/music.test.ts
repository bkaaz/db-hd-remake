import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "../rom/cartridge";
import { fightSongIds, renderSong, songIds } from "./music";

describe.skipIf(!existsSync(ROM_PATH))("a fight's song on the cartridge's driver", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const peak = (s: Float32Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  it("names songs 1 to 0x14, each with an upload of its own", () => {
    expect(songIds(rom)).toEqual(Array.from({ length: 0x14 }, (_, i) => i + 1));
  });

  it("lets a fight play songs 1 to 9, as the pre-fight choice steps through them", () => {
    expect(fightSongIds(rom)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("plays once asked for on port 0, on both sides", () => {
    const song = renderSong(rom, 1, 2);
    expect(peak(song.left)).toBeGreaterThan(0.05);
    expect(peak(song.right)).toBeGreaterThan(0.05);
  });
});
