import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateStates, type AnimInfo, type StatesFile } from "../entity/states";
import { ROM_PATH } from "./cartridge";
import { fighterStates, generatedFighters, tablesOf } from "./fighterStates";

describe.skipIf(!existsSync(ROM_PATH))("a fighter's generated states.json, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("covers Vegeta and leaves Goku, whose states are the template, out", () => {
    expect(generatedFighters()).toContain("vegeta");
    expect(generatedFighters()).not.toContain("goku");
  });

  it.each(generatedFighters())("%s plays only animations he has and fires only objects that exist", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, unknown>;
    for (const [state, def] of Object.entries(states)) {
      if (def.anim) expect(animations, `${name} ${state}`).toHaveProperty([def.anim]);
      for (const spawn of [def.fires?.spawn, ...(def.fires?.with ?? []).map((w) => w.spawn)]) {
        if (spawn) expect(existsSync(`data/spawns/${spawn}/animations.json`), `${name} ${state} fires ${spawn}`).toBe(true);
      }
    }
  });

  it.each(generatedFighters())("%s passes the validator the game runs on loading him", (name) => {
    const file = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, AnimInfo>;
    expect(validateStates(file, animations).errors).toEqual([]);
  });

  it.each(generatedFighters())("%s's is what the template and his specials make", (name) => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8"));
    const { file } = fighterStates(rom, name, tablesOf(rom, name));
    expect(onDisk, "out of date — npm run rom -- states --all").toEqual(JSON.parse(JSON.stringify(file)));
  });
});
