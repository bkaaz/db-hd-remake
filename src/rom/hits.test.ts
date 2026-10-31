import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blowStarts } from "./animation";
import { blowOfAnim } from "./animBlow";
import { fighterNamed, ROSTER } from "./roster";
import { GOKU as GOKU_TABLES, ROM_PATH, scriptAt } from "./cartridge";
import { readBoxes } from "./collision";
import { readScript } from "./script";
import { groundReaction, hitRecords, objectRecord, recordAt } from "./hits";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("hitRecords, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const GOKU = GOKU_TABLES.character;
  const VEGETTO = 4;

  it("reads far Y as one record for every step: heavy, 27 damage, 6 stun", () => {
    const [far, ...rest] = hitRecords(rom, GOKU, 0x92);
    expect(rest).toEqual([]);
    expect(far).toMatchObject({ upToStep: null, damage: 27, stun: 6 });
    expect(groundReaction(far)).toBe("heavy");
  });

  it("gives each of Quadruple Kick's four blows its own record: 24, 25, 26, 27", () => {
    const records = hitRecords(rom, GOKU, 0xa5);
    const starts = blowStarts(readScript(rom, scriptAt(rom, GOKU_TABLES, 0xa5)), (d) =>
      readBoxes(rom, GOKU_TABLES.boxes, d),
    );
    expect(starts.map((step) => recordAt(records, step)?.damage)).toEqual([24, 25, 26, 27]);
  });

  it("reads a move that hits differently step by step as several records", () => {
    expect(hitRecords(rom, GOKU, 0xa2).map((r) => r.upToStep)).toEqual([2, 5, null]);
  });

  it("reads Vegetto's own table, which is what his recorded blows took", () => {
    // Recorded 2026-10-29: his 9e took 22 off Goku, whose defence is 8.
    expect(hitRecords(rom, VEGETTO, 0x9e).at(-1)?.damage).toBe(30);
  });

  it("reads goku's ki blast from the objects' table: heavy, 18, stun 2", () => {
    const ki = objectRecord(rom, 0x0a, 3);
    expect([groundReaction(ki), ki.damage, ki.stun]).toEqual(["heavy", 18, 2]);
    const { states } = JSON.parse(readFileSync("data/spawns/goku_ki/states.json", "utf8")) as StatesFile;
    expect([states.fly.type, states.fly.damage]).toEqual(["heavy", 18]);
  });

  it("agrees with every blow a fighter's states copied from it", () => {
    // The states are written by hand (ADR 0013) or from a template
    // (template.ts); this is what keeps the copy honest. A state playing move
    // mNN takes that move's damage and the type named after its reaction.
    const fighters = ROSTER.filter((name) => existsSync(`data/entities/${name}/states.json`));
    expect(fighters).toContain("goku");
    for (const fighter of fighters) {
      const t = fighter === "goku" ? GOKU_TABLES : fighterNamed(rom, fighter);
      const states = (JSON.parse(readFileSync(`data/entities/${fighter}/states.json`, "utf8")) as StatesFile).states;
      const blows = Object.entries(states).filter(([, def]) => def.type !== undefined);
      expect(blows.length).toBeGreaterThan(0);
      for (const [name, def] of blows) {
        const blow = blowOfAnim(rom, t, def.anim ?? "");
        expect(blow, `${fighter} ${name} plays ${def.anim}`).not.toBeNull();
        expect([def.type, def.damage], `${fighter} ${name}`).toEqual([blow?.type, blow?.damage]);
      }
    }
  });
});

describe("recordAt", () => {
  const rec = (upToStep: number | null, damage: number) => ({ upToStep, reaction: 0x10, damage, stun: 1 });
  const kicks = [rec(1, 24), rec(4, 25), rec(null, 26)];

  it("takes the first record covering the step", () => {
    expect(recordAt(kicks, 0)?.damage).toBe(24);
    expect(recordAt(kicks, 2)?.damage).toBe(25);
    expect(recordAt(kicks, 4)?.damage).toBe(25);
  });

  it("falls through to the record for every step", () => {
    expect(recordAt(kicks, 40)?.damage).toBe(26);
  });
});
