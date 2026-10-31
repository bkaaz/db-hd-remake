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

  it("in that resource's palette, the first of the run OBJ palette 0 steps through", () => {
    expect(def.palette).toBe(0x27bd24);
  });

  it("holds each frame as long as the recording did, once through", () => {
    expect([def.frames, def.steps, def.loop]).toEqual([[0, 1, 0, 1, 0, 1, 0], [4, 5, 5, 5, 5, 6, 6], false]);
  });

  it("refuses an object the recording never showed", () => {
    expect(() => ownObjects(rom, vegeta, OWN_OBJECTS.vegeta!, [ball])).toThrow(/vegeta_flash .* not in the recording/);
  });
});
