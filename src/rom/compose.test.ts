import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeStates } from "./compose";
import { generatedFighters } from "./fighterStates";

describe("a fighter's states.json, from our files alone", () => {
  it.each(generatedFighters())("%s's is what the common states, his overrides and his specials make", (name) => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8"));
    expect(onDisk, "out of date — npm run states").toEqual(JSON.parse(JSON.stringify(composeStates(name))));
  });
});
