import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { GOKU, ROM_PATH } from "./cartridge";
import { fighterNamed } from "./roster";
import { moveOf, todo } from "./todo";

describe("moveOf", () => {
  it("reads the move an exported animation plays, a part's included", () => {
    expect([moveOf("m9d"), moveOf("m1b_3"), moveOf("held"), moveOf(undefined)]).toEqual([0x9d, 0x1b, null, null]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("todo, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const states = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
  const left = todo(rom, fighterNamed(rom, "vegeta"), [{ name: "goku", t: GOKU, states }]);

  it("counts as read a move on code goku's states already play: the far Y, the ki blast", () => {
    expect(left.read.find((r) => r.move === 0x92)?.states).toContain("attack_y");
    expect(left.read.map((r) => r.move)).toContain(0x9b);
  });

  it("leaves to read his own code, once a handler, whichever of his moves run it", () => {
    const final = left.toRead.find((r) => r.moves.includes(0xa4));
    expect(final?.moves).toEqual([0xa4, 0xcf]);
    expect(left.toRead.flatMap((r) => r.moves)).not.toContain(0x92);
  });

  it("puts first what the whole roster runs: the jumping normals", () => {
    expect(left.toRead[0]).toMatchObject({ handler: 0x20baba, fighters: 10, moves: [0x96, 0x97, 0x98, 0x99] });
  });
});
