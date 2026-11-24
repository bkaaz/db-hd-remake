import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { hitFields, objectHit } from "./objectHit";

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
});
