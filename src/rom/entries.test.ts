import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { GOKU, ROM_PATH } from "./cartridge";
import { readCommands } from "./commands";
import { inTableOrder, missingEntries } from "./entries";
import { handlerAt, handlerFacts } from "./handler";
import { fighterNamed } from "./roster";
import { READS_COMMANDS } from "./routines";

describe.skipIf(!existsSync(ROM_PATH))("where commands are read, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const reads = (move: number) =>
    handlerFacts(rom, handlerAt(rom, GOKU.character, move), 0, GOKU.character).find((f) => f.what === READS_COMMANDS);

  it("reads $0F:9EB1 where it is called: idle unless turning, the stand-up always, a block from frame 4", () => {
    expect(reads(0x00)?.when).toEqual(["unless turning"]);
    expect(reads(0x04)).toMatchObject({ frame: null });
    expect(reads(0x04)?.when).toBeUndefined();
    expect(reads(0x0d)?.from).toBe(4);
    // a normal reads none: far Y's handler, $0F:AA54
    expect(reads(0x92)).toBeUndefined();
  });

  // the states a player stands, walks or crouches in — the Double Kick was missing from the stand-up
  const NEUTRAL = ["idle", "walk_fwd", "walk_back", "crouch_down", "crouch", "crouch_loop", "stand_up"];

  for (const name of ["goku", "vegeta"]) {
    it(`finds every command of ${name}'s in the states he stands, walks and crouches in`, () => {
      const t = name === "goku" ? GOKU : fighterNamed(rom, name);
      const states = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
      expect(missingEntries(rom, t, states).filter((m) => NEUTRAL.includes(m.state))).toEqual([]);
    });

    it(`tries ${name}'s commands as the cartridge does, the table's last row first`, () => {
      const t = name === "goku" ? GOKU : fighterNamed(rom, name);
      const states = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
      expect(inTableOrder(states, readCommands(rom, t.character))).toEqual(states);
    });
  }
});
