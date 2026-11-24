import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { COMMON, composeStates } from "./compose";
import { generatedFighters } from "./fighterStates";
import { staleCopies, type SpecialsFile } from "./specials";

describe("a fighter's states.json, from our files alone", () => {
  it.each(generatedFighters())("%s's is what the common states, his overrides and his specials make", (name) => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8"));
    expect(onDisk, "out of date — npm run states").toEqual(JSON.parse(JSON.stringify(composeStates(name))));
  });
});

describe("a copy a fighter replaces a common state with", () => {
  const common = JSON.parse(readFileSync(COMMON, "utf8")) as StatesFile;

  it.each(generatedFighters().filter((name) => existsSync(`data/entities/${name}/specials.json`)))(
    "%s's are each checked against the common state as it is now",
    (name) => {
      const specials = JSON.parse(readFileSync(`data/entities/${name}/specials.json`, "utf8")) as SpecialsFile;
      expect(staleCopies(common, specials), "the common state changed — npm run states says what to do").toEqual([]);
    },
  );
});
