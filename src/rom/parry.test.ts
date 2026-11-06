import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { ROM_PATH } from "./cartridge";
import { parryExceptions } from "./parry";

describe.runIf(existsSync(ROM_PATH))("parryExceptions, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("is X and each fighter's 3D move", () => {
    const table = parryExceptions(rom);
    expect(table.goku).toEqual(["9a", "a8"]);
    expect(table.piccolo).toEqual(["9a", "9e"]);
    expect(Object.values(table).every((moves) => moves[0] === "9a" && moves.length === 2)).toBe(true);
  });

  it("is what Regeneration's data carries", () => {
    const { states } = JSON.parse(readFileSync("data/entities/piccolo/specials.json", "utf8")) as StatesFile;
    expect(states.regeneration.parry?.except).toEqual(parryExceptions(rom));
  });
});
