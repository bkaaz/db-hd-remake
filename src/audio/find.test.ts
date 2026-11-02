import { describe, expect, it } from "vitest";
import { alignInOrder, clearMatch, fillGaps, playerOneOf, requests, romIds, single, unanswered } from "./find";

const LOG = ["# header", "f833 v7 env=127 pitch=07d8 src=15", "f833 sound 3d", "f834 sound 32", "f900 sound 3d", "f901 sound 0c"].join("\n");

describe("finding a sound the bank lacks", () => {
  it("reads every request with its frame, the voices' lines left alone", () => {
    expect(requests(LOG)).toEqual([
      { frame: 833, id: 0x3d }, { frame: 834, id: 0x32 }, { frame: 900, id: 0x3d }, { frame: 901, id: 0x0c },
    ]);
  });

  it("names the ids a bank answers, the first bank winning", () => {
    const ids = romIds({ land_1: { file: "010.wav", gain: 1, rom: 0x0c } }, { voice_shout: { file: "x.wav", gain: 1, rom: 0x32 }, other: { file: "y.wav", gain: 1, rom: 0x0c } });
    expect([...ids]).toEqual([[0x0c, "land_1"], [0x32, "voice_shout"]]);
  });

  it("lists each unanswered id once, at the first frame it was asked", () => {
    const known = new Map([[0x0c, "land_1"], [0x32, "voice_shout"]]);
    expect(unanswered(requests(LOG), known)).toEqual([{ frame: 833, id: 0x3d }]);
  });

  it("takes player two's id as player one's, through the cartridge's shifts", () => {
    const shifts = Array<number>(0x40).fill(0);
    shifts[0x0c] = 9;
    shifts[0x32] = 3;
    expect(playerOneOf(0x15, shifts)).toBe(0x0c);
    expect(playerOneOf(0x3d, shifts)).toBeUndefined();
    const known = new Map([[0x0c, "land_1"], [0x32, "voice_shout"]]);
    expect(unanswered([{ frame: 1, id: 0x15 }, { frame: 2, id: 0x35 }, { frame: 3, id: 0x3d }], known, shifts)).toEqual([{ frame: 3, id: 0x3d }]);
  });

  it("calls a match clear only when it stands well above the next", () => {
    expect(clearMatch(0.39, 0.16)).toBe(true);
    expect(clearMatch(0.27, 0.1)).toBe(false);
    expect(clearMatch(0.56, 0.32)).toBe(false);
  });

  it("drops a burst of writes in one frame — music going up to the chip, not sounds", () => {
    const asked = [{ frame: 60, id: 0x02 }, { frame: 4698, id: 0x45 }, { frame: 4698, id: 0xb4 }, { frame: 4698, id: 0x01 }];
    expect(single(asked)).toEqual([{ frame: 60, id: 0x02 }]);
  });

  it("pairs in order, so a weak likeness between two strong ones lands between them", () => {
    // row 1 alone would take column 0 (0.3), but rows 0 and 2 are sure of 1 and 3
    const scores = [
      [0.1, 0.9, 0.1, 0.1],
      [0.3, 0.1, 0.2, 0.1],
      [0.1, 0.1, 0.1, 0.8],
    ];
    expect(alignInOrder(scores)).toEqual([1, 2, 3]);
  });

  it("fills a gap with the clips its neighbours leave free, only when they fit", () => {
    expect(fillGaps([3, null, 5], 8)).toEqual([3, 4, 5]);
    expect(fillGaps([3, null, null, 6], 8)).toEqual([3, 4, 5, 6]);
    expect(fillGaps([null, null, 1], 8)).toEqual([null, null, 1]);
  });
});
