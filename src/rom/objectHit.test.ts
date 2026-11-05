import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { hitFields, objectHit } from "./objectHit";

const FIGHTERS = ["vegetto", "piccolo", "freeza", "cell", "mr_buu", "buu", "gotenks"];

/** Drafted with the same explosion for all, and not put right yet: `docs/bugs.md`. Delete as each is. */
const NOT_YET = new Set([
  "piccolo_5_0b", "piccolo_5_07", "piccolo_5_06", "piccolo_5_05",
  "freeza_6_14", "freeza_6_15",
  "cell_7_03", "cell_a_21", "cell_a_22", "cell_a_23",
  "buu_a_20", "buu_9_08",
]);

describe("hitFields", () => {
  it("an object that stays plays on, with a melee blow's spark and sounds", () => {
    const { file, state } = hitFields({ stays: true });
    expect(file).toEqual({ hitFx: "hit_spark", guardFx: "guard_spark" });
    expect(state).toEqual({ hitSound: "hit_09", blockSound: "block_17", outlivesHit: true });
  });

  it("only the largest explosion whitens the screen", () => {
    expect(hitFields({ stays: false, becomes: { type: 0xa, anim: 0x18 }, burns: true }).state.hitFlash).toBe(16);
    expect(hitFields({ stays: false, becomes: { type: 0xa, anim: 0x17 }, burns: true }).state.hitFlash).toBeUndefined();
  });

  it("one rewritten as an explosion names its burst, and refuses one with no spawn", () => {
    expect(hitFields({ stays: false, becomes: { type: 0xa, anim: 0x17 }, burns: false }).state.burstsInto).toBe("burst_m");
    expect(() => hitFields({ stays: false, becomes: { type: 0xa, anim: 0x7f }, burns: false })).toThrow("no spawn");
  });
});

describe.skipIf(!existsSync(ROM_PATH))("objectHit, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads what rom.md has confirmed by recording", () => {
    expect(objectHit(rom, 0xa, 0x03)).toMatchObject({ stays: false, becomes: { type: 0xa, anim: 0x01 } });
    expect(objectHit(rom, 0xa, 0x14)).toMatchObject({ stays: false, becomes: { type: 0xa, anim: 0x17 } });
    expect(objectHit(rom, 0x1, 0x02)).toEqual({ stays: true });
    expect(objectHit(rom, 0x8, 0x08)).toEqual({ stays: true });
  });

  it("reads which explosions set the defender burning ($2A:99CC)", () => {
    expect(objectHit(rom, 0xa, 0x14)).toMatchObject({ burns: true }); // the Kamehameha's middle head
    expect(objectHit(rom, 0x8, 0x0f)).toMatchObject({ burns: true }); // Mightiness Bomber's
    expect(objectHit(rom, 0xa, 0x03)).toMatchObject({ burns: false }); // the ki blast
  });

  it.each(FIGHTERS)("%s: each object burns and whitens as the cartridge says, in every state that strikes", (fighter) => {
    const objects = JSON.parse(readFileSync(`data/entities/${fighter}/objects.json`, "utf8")) as { name: string; type: number; anim: number }[];
    const wrong: string[] = [];
    for (const { name, type, anim } of objects) {
      const path = `data/spawns/${name}/states.json`;
      if (!existsSync(path) || NOT_YET.has(name)) continue;
      const hit = objectHit(rom, type, anim);
      const burns = !hit.stays && hit.burns;
      const flash = hit.stays ? undefined : hitFields(hit).state.hitFlash;
      const blows = Object.values(JSON.parse(readFileSync(path, "utf8")).states as Record<string, Record<string, unknown>>).filter((s) => s.type);
      if (blows.some((b) => !!b.burns !== burns || b.hitFlash !== flash)) wrong.push(name);
    }
    expect(wrong).toEqual([]);
  });

  it.each(FIGHTERS)("%s: each object answers a hit as the cartridge says", (fighter) => {
    const objects = JSON.parse(readFileSync(`data/entities/${fighter}/objects.json`, "utf8")) as { name: string; type: number; anim: number }[];
    const wrong: string[] = [];
    for (const { name, type, anim } of objects) {
      const path = `data/spawns/${name}/states.json`;
      if (!existsSync(path)) continue;
      const blow = Object.values(JSON.parse(readFileSync(path, "utf8")).states as Record<string, Record<string, unknown>>).find((s) => s.type);
      if (!blow) continue;
      const hit = objectHit(rom, type, anim);
      const right = hit.stays ? blow.outlivesHit === true : blow.burstsInto === hitFields(hit).state.burstsInto;
      // one put right must leave the list, or the list stops meaning anything
      if (right === NOT_YET.has(name)) wrong.push(name);
    }
    expect(wrong).toEqual([]);
  });
});
