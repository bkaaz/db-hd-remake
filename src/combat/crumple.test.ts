import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { generatedFighters } from "../rom/fighterStates";

/**
 * The stun a charged S2 leaves (`crumple`, `combat.md`): a body standing open
 * to a new combo has to be one — pushed against and hit — in every pose it
 * sways through. A pose from a hold has no boxes: the holder places it.
 */
const read = <T>(name: string, file: string): T => JSON.parse(readFileSync(`data/entities/${name}/${file}`, "utf8")) as T;

describe.each(generatedFighters())("%s stunned", (name) => {
  const { states } = read<StatesFile>(name, "states.json");
  const anims = read<Record<string, { steps: { boxes?: { type: string }[] }[] }>>(name, "animations.json");

  it("can be pushed against and hit in every pose of it", () => {
    for (const step of anims[states.crumple.anim].steps) {
      const types = new Set((step.boxes ?? []).map((b) => b.type));
      expect([types.has("push"), types.has("hurt")]).toEqual([true, true]);
    }
  });
});

describe.each(generatedFighters())("%s sent off", (name) => {
  const { states } = read<StatesFile>(name, "states.json");
  const anims = read<Record<string, { steps: { boxes?: { type: string }[] }[] }>>(name, "animations.json");

  it("can be hit in his flight, his body another pose's where his own has none", () => {
    const body = states.sent_off.boxesOf ?? states.sent_off.anim;
    const types = new Set((anims[body].steps[0].boxes ?? []).map((b) => b.type));
    expect([types.has("push"), types.has("hurt")]).toEqual([true, true]);
  });
});
