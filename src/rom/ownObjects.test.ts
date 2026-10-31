import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { OWN_OBJECTS, ownObjects } from "./ownObjects";
import type { Life } from "./recording";
import { fighterNamed } from "./roster";

describe.skipIf(!existsSync(ROM_PATH))("a fighter's own objects", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const vegeta = fighterNamed(rom, "vegeta");
  // the ball's life as his recording shows it (logs/objects-rec.txt)
  const ball: Life = {
    slot: 0, type: 1, anim: 4, from: 2698, to: 2734, x: 0, y: 0, vx: 4, vy: -4, hit: false,
    steps: [[0, 4], [1, 5], [0, 5], [1, 5], [0, 5], [1, 6], [0, 6]].map(([frame, dur]) => ({ frame, dur })),
  };
  const [def] = ownObjects(rom, vegeta, OWN_OBJECTS.vegeta!.filter((o) => o.anim === 4), [ball]);

  it("draws from what the spawning move loads for player one: ad's resource 4f at $6C00", () => {
    expect(def.loads).toEqual([{ resource: 0x4f, vram: 0x6c00 }]);
  });

  it("in the palette its code loads, the first of the run OBJ palette 0 steps through", () => {
    expect(def.palette).toBe(0x27bd24);
    const [head] = ownObjects(rom, vegeta, OWN_OBJECTS.vegeta!.filter((o) => o.anim === 0xb), [{ ...ball, anim: 0xb }]);
    expect(head.palette).toBe(0x2ade1c);
  });

  it("holds each frame as long as the recording did, once through", () => {
    expect([def.frames, def.steps, def.loop]).toEqual([[0, 1, 0, 1, 0, 1, 0], [4, 5, 5, 5, 5, 6, 6], false]);
  });

  // Final Flash's small head, recorded as the global counter happened to find it
  const head: Life = {
    ...ball, anim: 0xb, vy: 0,
    steps: [[1, 4], [2, 8], [3, 8], [0, 5], [1, 6]].map(([frame, dur]) => ({ frame, dur })),
  };
  const base: Life = { ...ball, anim: 0xa, vx: 0, vy: 0, steps: [{ frame: 0, dur: 6 }] };
  const named = (anim: number) => OWN_OBJECTS.vegeta!.filter((o) => o.anim === anim);

  it("cycles through the frames the recording showed, each as long as the code says, not as the slowed game did", () => {
    const [def] = ownObjects(rom, vegeta, named(0xb), [head]);
    expect([def.frames, def.steps, def.loop]).toEqual([[0, 1, 2, 3], [4, 4, 4, 4], true]);
    expect(def.loads).toEqual([{ resource: 0x4d, vram: 0x6c00 }]);
  });

  it("plays a way in, a loop and a way out where the code does, and nothing of the recording's timing", () => {
    const [def] = ownObjects(rom, vegeta, named(0xa), [base]);
    expect(def.steps).toEqual([]);
    expect(def.animations?.loop).toEqual({ frames: [2, 3, 4], dur: 4, loop: true });
  });

  it("refuses an object the recording never showed", () => {
    expect(() => ownObjects(rom, vegeta, OWN_OBJECTS.vegeta!, [ball])).toThrow(/vegeta_flash .* not in the recording/);
  });
});
