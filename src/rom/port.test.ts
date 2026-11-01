import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { portReport } from "./port";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("portReport, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const quad = portReport(rom, GOKU, 0xa5);

  it("reads the throw: → + X, in Goku's grab range, holding the opponent in move 30", () => {
    const thrown = portReport(rom, GOKU, 0x9d);
    expect(thrown.inputs).toEqual(["ground: → + X"]);
    expect(thrown.commands[0].opponentMove).toBe(0x30);
    expect(thrown.commands[0].needs.at(-1)).toMatch(/within 42 px/);
  });

  it("reads a handler that picks its frame with CPY, and holds only on the steps it holds on", () => {
    // Saiyan Meteor's follow-up: LDY $44,X / CPY #1 — the hold is frame 1's, once
    const meteor = portReport(rom, GOKU, 0xae);
    expect(meteor.anyFrame.some((f) => f.hold !== undefined)).toBe(false);
    expect(meteor.holds[0]).toMatchObject({ against: "goku", steps: [0], at: [[40, 0]] });
    // the throw holds every frame: all three steps, as before
    expect(portReport(rom, GOKU, 0x9d).holds[0].at).toEqual([[24, 0], [22, 0], [-32, -32]]);
  });

  it("cuts a move where a handler pinned to a step by CMP jumps", () => {
    // Saiyan Meteor's rush: CMP #$0C on field 0x46, then frame 128 once he is close
    const meteor = portReport(rom, GOKU, 0xad);
    expect(meteor.parts.map((p) => [p.anim, p.from])).toEqual([["mad", 0], ["mad_2", 128]]);
  });

  it("picks the Kamehameha's head by the spawn counter the handler sets", () => {
    const kame = portReport(rom, GOKU, 0xaa);
    const heads = kame.parts.flatMap((p) => p.spawns).filter((s) => s.blow.damage > 0);
    expect(heads.map((s) => [s.counter, s.anim, s.blow.damage])).toEqual([
      [0x00, 0x15, 80],
      [0x10, 0x14, 60],
      [0x18, 0x13, 40],
    ]);
    const counters = kame.anyFrame.filter((f) => f.counter !== undefined);
    expect(counters.map((f) => [f.from, f.counter])).toEqual([[32, 0x10], [20, 0x18]]);
  });

  it("asks for Quadruple Kick the way the command table does", () => {
    expect(quad.inputs).toEqual(["ground: ← ↙ ↓ ↘ → B"]);
  });

  it("lays it out as a part per blow, the last kick cut again where it is re-armed", () => {
    expect(quad.parts.map((p) => [p.anim, p.from, p.frames])).toEqual([
      ["ma5", 0, 26], ["ma5_2", 26, 22], ["ma5_3", 48, 18], ["ma5_4", 66, 4], ["ma5_5", 70, 24],
    ]);
    expect(quad.parts.map((p) => p.blow && [p.blow.type, p.blow.damage])).toEqual([
      ["heavy", 24], ["heavy", 25], ["heavy", 26], ["down", 27], ["down", 27],
    ]);
  });

  it("gives each part its slice of the handler's speeds, frames counted from the part", () => {
    expect(quad.parts.map((p) => [p.vel, p.velAt])).toEqual([
      [0, [[14, 2.375], [18, 1.25]]],
      [1.25, [[0, 2.375], [6, 1.25]]],
      [1.25, [[0, 2.375], [6, 1.25]]],
      [1.25, []],
      [1.25, [[0, 2.375], [6, 1.25]]],
    ]);
  });

  it("is what goku's states copied", () => {
    const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
    for (const part of quad.parts) {
      const [name, def] = Object.entries(states).find(([, d]) => d.anim === part.anim) ?? [];
      expect(def, part.anim).toBeDefined();
      expect(def?.velAt ?? [], name).toEqual(part.velAt);
      expect(def?.type, name).toBe(part.blow?.type);
      expect(def?.damage, name).toBe(part.blow?.damage);
    }
  });

  it("says where blows pass him by, and goku's states keep it: the knee slash's start, the knockdown", () => {
    const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
    for (const move of [0xa4, 0x1b]) {
      let on = false;
      for (const part of portReport(rom, GOKU, move).parts) {
        // a part takes what holds at its start; field 0x96 is set on a part's first frame here
        on = part.unhittable.find((u) => u.frame === 0)?.on ?? on;
        const [name, def] = Object.entries(states).find(([, d]) => d.anim === part.anim) ?? [];
        expect([name, !!def?.invulnerable]).toEqual([name, on]);
      }
    }
  });
});
