import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { moveParts, ownFacts } from "./parts";
import { fighterNamed } from "./roster";

describe.skipIf(!existsSync(ROM_PATH))("moveParts, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("cuts a dash where its handler sends it: a run of one step, and Gohan's of three", () => {
    const cuts = (t: Parameters<typeof moveParts>[1]) => moveParts(rom, t, 0x0a).parts.map((p) => p.from);
    expect(cuts(fighterNamed(rom, "vegeta"))).toEqual([0, 8, 16]);
    expect(cuts(fighterNamed(rom, "gohan"))).toEqual([0, 6, 18]);
  });

  it("cuts pinned (4a) where each fall lands: its fall, its bounce, then lying", () => {
    expect(moveParts(rom, GOKU, 0x4a).parts.map((p) => [p.anim, p.from])).toEqual([
      ["m4a", 0],
      ["m4a_2", 24],
      ["m4a_3", 32],
    ]);
  });

  const vegeta = fighterNamed(rom, "vegeta");
  const starts = (move: number) => moveParts(rom, vegeta, move).parts.map((p) => p.from);

  it("cuts where blows start or stop passing him by: Jumping Bomb's 16, Energy Dash's 28", () => {
    expect(starts(0x9e)).toEqual([0, 16, 26]);
    expect(starts(0xa7)).toEqual([0, 28]);
  });

  it("cuts where a handler running by frame jumps to a step of its own: Vertical Ki's landing at 56", () => {
    expect(starts(0xb1).at(-1)).toBe(56);
  });
});

describe("ownFacts", () => {
  const set = { frame: 0, what: "sets move", move: 0x1a };
  const jump = { frame: 0, what: "jumps to frame", to: 21 };

  it("drops a jump made after setting another move: that move's frame", () => {
    expect(ownFacts([set, jump])).toEqual([set]);
  });

  it("drops a speed set after it, on a branch inside its own: that move's speed", () => {
    const ran = { ...set, frame: null, when: ["once the script has run out"] };
    const vx = { frame: null, what: "sets vx", vx: 1.5, when: [...ran.when, "facing left"] };
    expect(ownFacts([ran, vx])).toEqual([ran]);
  });

  it("keeps a jump on another branch, a speed set before, or after the opponent's move is set", () => {
    const landed = { ...jump, when: ["once it has landed"] };
    expect(ownFacts([set, landed])).toEqual([set, landed]);
    const before = { frame: 0, what: "sets vx", vx: 2 };
    expect(ownFacts([before, set])).toEqual([before, set]);
    const theirs = { ...set, who: "opponent" as const };
    expect(ownFacts([theirs, jump])).toEqual([theirs, jump]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("Bukuuh Kyaku's a9", () => {
  const { anims } = moveParts(new Uint8Array(readFileSync(ROM_PATH)), fighterNamed(new Uint8Array(readFileSync(ROM_PATH)), "gohan"), 0xa9);

  it("is one part, 1a's frame 21 no cut of its own", () => {
    expect(Object.keys(anims)).toEqual(["ma9"]);
    expect(anims.ma9.steps.reduce((n, s) => n + (s.dur ?? 0), 0)).toBe(73);
  });
});
