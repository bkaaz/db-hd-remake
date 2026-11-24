import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { GOKU, ROM_PATH } from "./cartridge";
import { inTableOrder } from "./entries";
import { handlerAt, handlerFacts } from "./handler";
import { READS_COMMANDS } from "./routines";

describe.skipIf(!existsSync(ROM_PATH))("where commands are read, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const reads = (move: number) =>
    handlerFacts(rom, handlerAt(rom, GOKU.character, move), 0, GOKU.character).find((f) => f.what === READS_COMMANDS);

  it("reads $0F:9EB1 where it is called: idle unless turning, the stand-up always, a block from frame 4", () => {
    expect(reads(0x00)?.when).toEqual(["unless turning"]);
    expect(reads(0x04)).toMatchObject({ frame: null });
    expect(reads(0x04)?.when).toBeUndefined();
    expect(reads(0x0d)?.from).toBe(4);
    // a normal reads none: far Y's handler, $0F:AA54
    expect(reads(0x92)).toBeUndefined();
  });
});

describe("inTableOrder", () => {
  const file: StatesFile = {
    initial: "idle",
    states: {
      idle: {
        anim: "m00",
        transitions: [
          { when: "held:guard", to: "guard" },
          { when: "command:a5", to: "quad" },
          { when: "pressed:attack", to: "jab" },
          { when: ["grab", "command:9d"], to: "throw" },
        ],
      },
    },
  };

  it("puts the command entries where the first stood, the table's last row first, the rest in their places", () => {
    const out = inTableOrder(file, [{ move: 0xa5 }, { move: 0x9d }]);
    expect(out.states.idle.transitions!.map((t) => t.to)).toEqual(["guard", "throw", "quad", "jab"]);
  });

  it("leaves the file it was given as it was", () => {
    inTableOrder(file, [{ move: 0xa5 }, { move: 0x9d }]);
    expect(file.states.idle.transitions!.map((t) => t.to)).toEqual(["guard", "quad", "jab", "throw"]);
  });
});
