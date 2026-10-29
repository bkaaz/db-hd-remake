import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { groundReaction, hitRecords } from "./hits";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("hitRecords, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const GOKU = 0;
  const VEGETTO = 4;

  it("reads far Y as one record for every step: heavy, 27 damage, 6 stun", () => {
    const [far, ...rest] = hitRecords(rom, GOKU, 0x92);
    expect(rest).toEqual([]);
    expect(far).toMatchObject({ upToStep: null, damage: 27, stun: 6 });
    expect(groundReaction(far)).toBe("heavy");
  });

  it("reads a move that hits differently step by step as several records", () => {
    expect(hitRecords(rom, GOKU, 0xa2).map((r) => r.upToStep)).toEqual([2, 5, null]);
  });

  it("reads Vegetto's own table, which is what his recorded blows took", () => {
    // Recorded 2026-10-29: his 9e took 22 off Goku, whose defence is 8.
    expect(hitRecords(rom, VEGETTO, 0x9e).at(-1)?.damage).toBe(30);
  });

  it("agrees with every blow goku's states copied from it", () => {
    // The states are written by hand (ADR 0013); this is what keeps the copy
    // honest. A state playing move mNN takes that move's damage and the type
    // named after its reaction.
    const states = (JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile).states;
    const blows = Object.entries(states).filter(([, def]) => def.type !== undefined);
    expect(blows.length).toBeGreaterThan(0);
    for (const [name, def] of blows) {
      const move = parseInt(/^m([0-9a-f]{2})$/.exec(def.anim ?? "")?.[1] ?? "", 16);
      const records = hitRecords(rom, GOKU, move);
      expect(records, `${name} plays ${def.anim}`).toHaveLength(1);
      expect(def.damage, name).toBe(records[0].damage);
      expect(def.type, name).toBe(groundReaction(records[0]));
    }
  });
});
