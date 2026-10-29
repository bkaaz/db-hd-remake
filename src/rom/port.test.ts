import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { portReport } from "./port";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("portReport, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const quad = portReport(rom, GOKU, 0xa5);

  it("asks for Quadruple Kick the way the command table does", () => {
    expect(quad.inputs).toEqual(["ground: ← ↙ ↓ ↘ → B"]);
  });

  it("lays it out as four parts, one blow each, with the cartridge's numbers", () => {
    expect(quad.parts.map((p) => [p.anim, p.from, p.frames])).toEqual([
      ["ma5", 0, 26], ["ma5_2", 26, 22], ["ma5_3", 48, 18], ["ma5_4", 66, 28],
    ]);
    expect(quad.parts.map((p) => p.blow && [p.blow.type, p.blow.damage])).toEqual([
      ["heavy", 24], ["heavy", 25], ["heavy", 26], ["down", 27],
    ]);
  });

  it("gives each part its slice of the handler's speeds, frames counted from the part", () => {
    expect(quad.parts.map((p) => [p.vel, p.velAt])).toEqual([
      [0, [[14, 2.375], [18, 1.25]]],
      [1.25, [[0, 2.375], [6, 1.25]]],
      [1.25, [[0, 2.375], [6, 1.25]]],
      [1.25, [[4, 2.375], [10, 1.25]]],
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
});
