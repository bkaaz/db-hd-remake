import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateStates, type AnimInfo, type StatesFile } from "../entity/states";
import { generatedFighters } from "./fighterStates";

describe("a fighter's generated states.json", () => {
  it("covers Goku like the rest, the common states being a file of their own", () => {
    expect(generatedFighters()).toEqual(expect.arrayContaining(["goku", "vegeta"]));
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

  it.each(generatedFighters())("%s's crouching block ends crouched: down held, he never passes through standing", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const block = states.guard_crouch;
    expect(states[block.inputsOf!.state].crouching).toBe(true);
    expect(states[block.transitions!.find((t) => String(t.when).startsWith("frames:"))!.to!].crouching).toBe(true);
  });

  it.each(generatedFighters())("%s passes the validator the game runs on loading him", (name) => {
    const file = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, AnimInfo>;
    expect(validateStates(file, animations).errors).toEqual([]);
  });
});
