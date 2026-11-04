import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { heldAnims, heldByTable, heldIn } from "./held";
import type { ScriptOp } from "./script";

describe("heldIn", () => {
  const ops: ScriptOp[] = [
    { op: "show", frames: 4, drawing: 1 },
    { op: "show", frames: 10, drawing: 0x69, opponent: [0x17, 0x30] },
    { op: "show", frames: 10, drawing: 0x6a, opponent: [null, 0x31] },
    { op: "show", frames: 32, drawing: 0x6b, opponent: [0x20, 0x32] },
  ];

  it("takes the track's drawing for his character, as long as the thrower's step, keeping the last one where none is named", () => {
    expect(heldIn(ops, 0)?.steps).toEqual([{ frame: "23", dur: 10 }, { frame: "23", dur: 10 }, { frame: "32", dur: 32 }]);
    expect(heldIn(ops, 1)?.steps.map((s) => s.frame)).toEqual(["48", "49", "50"]);
  });

  it("is nothing for a script with no track", () => {
    expect(heldIn([{ op: "show", frames: 4, drawing: 1 }], 0)).toBeNull();
  });
});

describe.skipIf(!existsSync(ROM_PATH))("heldAnims, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("holds Goku in 17, 18, 20 when Goku throws him, 10 frames, 10, then 32 — crying out (30) as he is thrown", () => {
    const held = heldAnims(rom, 0);
    expect(held.m30_goku_9d.steps).toEqual([{ frame: "23", dur: 10 }, { frame: "24", dur: 10 }, { frame: "32", dur: 32, sfx: [0x30] }]);
    expect(Object.keys(held)).toContain("m30_piccolo_d9");
  });

  it("cries out at each of Vegeta's three blows while he holds him (his handler's 30 at 32, 56, 96)", () => {
    const steps = heldAnims(rom, 0).m30_vegeta_9d.steps;
    expect(steps.flatMap((st, i) => (st.sfx ? [i] : []))).toEqual([2, 4, 6]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("heldByTable, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("holds each character in the one drawing Gohan's 9d names for him, until it lets him go at 30", () => {
    const hold = { table: 0x20a716, frames: 30 };
    expect(heldByTable(rom, hold, 0).steps).toEqual([{ frame: "25", dur: 30 }]);
    expect(heldByTable(rom, hold, 2).steps).toEqual([{ frame: "35", dur: 30 }]);
  });

  it("is what a fighter's m30_gohan_9d plays, Gohan's 9d having no track", () => {
    expect(heldAnims(rom, 1).m30_gohan_9d?.steps).toEqual([{ frame: "32", dur: 30 }]);
  });
});
