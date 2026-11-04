import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateStates, type AnimInfo, type StatesFile } from "../entity/states";
import { ROM_PATH, scriptAt } from "./cartridge";
import { AIR_REEL, fighterStates, generatedFighters, tablesOf } from "./fighterStates";
import { CROUCH } from "./crouch";
import { holdStepOf, readScript } from "./script";

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

  it.each(["goku", ...generatedFighters()])("%s's air reel stops on the step his 1a holds, the jump's fall pose", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const t = tablesOf(rom, name);
    expect(states.reel_air.holdStep).toBe(holdStepOf(readScript(rom, scriptAt(rom, t, AIR_REEL))));
  });

  it.each(["goku", ...generatedFighters()])("%s's crouch stays on the drawing his 03 holds", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, { steps: { frame: string }[] }>;
    const { steps } = animations[states.crouch.anim!];
    const hold = readScript(rom, scriptAt(rom, tablesOf(rom, name), CROUCH)).find((op) => op.op === "hold");
    // Vegeta's holds nothing: his handler keeps him there ($20:9139)
    if (hold?.op !== "hold") return;
    expect(steps[states.crouch.holdStep ?? steps.length - 1].frame).toBe(String(hold.drawing));
  });

  it.each(["goku", ...generatedFighters()])("%s lies knocked out on the step his 1c holds, not on through its second fall", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, { steps: { frame: string; dur: number }[] }>;
    const step = animations[states.ko_down.anim!].steps[states.ko_down.holdStep!];
    const hold = readScript(rom, scriptAt(rom, tablesOf(rom, name), 0x1c)).find((op) => op.op === "hold");
    expect([step.frame, step.dur]).toEqual([String(hold?.op === "hold" && hold.drawing), 1]);
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
