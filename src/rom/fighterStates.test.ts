import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { fighterStates, generatedFighters, tablesOf } from "./fighterStates";

describe.skipIf(!existsSync(ROM_PATH))("a fighter's generated states.json, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("covers Vegeta and leaves Goku, whose states are the template, out", () => {
    expect(generatedFighters()).toContain("vegeta");
    expect(generatedFighters()).not.toContain("goku");
  });

  it.each(generatedFighters())("%s's is what the template and his specials make", (name) => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8"));
    const { file } = fighterStates(rom, name, tablesOf(rom, name));
    expect(onDisk, "out of date — npm run rom -- states --all").toEqual(JSON.parse(JSON.stringify(file)));
  });
});
