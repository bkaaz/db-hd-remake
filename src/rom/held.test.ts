import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { heldAnims, heldByTable, heldByWord, heldIn, waiting } from "./held";
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

describe("waiting", () => {
  it("lengthens the one step the thrower holds on", () => {
    const anim = { loop: false, steps: [{ frame: "1", dur: 6 }, { frame: "2", dur: 16 }] };
    expect(waiting(anim, { step: 0, frames: 82 }).steps.map((s) => s.dur)).toEqual([88, 16]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("Psychic Lift's hold", () => {
  it("waits with the thrower's 82 frames, and says nothing while he rises", () => {
    const rom = new Uint8Array(readFileSync(ROM_PATH));
    const { steps } = heldAnims(rom, 0).m30_cell_a6;
    expect(steps[0].dur).toBe(88);
    expect(steps.some((s) => s.sfx?.length)).toBe(false);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("heldAnims, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("holds Goku in 17, 18, 20 when Goku throws him, 10 frames, 10, then 32 — crying out (30) as he is thrown", () => {
    const held = heldAnims(rom, 0);
    expect(held.m30_goku_9d.steps).toEqual([{ frame: "23", dur: 10 }, { frame: "24", dur: 10 }, { frame: "32", dur: 32, sfx: [0x30] }]);
    expect(Object.keys(held)).toContain("m30_piccolo_d9");
  });

  it("holds each in the first drawing of his own move 34 when Gotenks throws him (fight-9: d024 on Gotenks)", () => {
    expect(heldAnims(rom, 3).m30_gotenks_9d?.steps).toEqual([{ frame: "36", dur: 30 }]);
    expect(heldAnims(rom, 0).m30_gotenks_9d?.steps).toEqual([{ frame: "25", dur: 30 }]);
  });

  it("cries out at each of Vegeta's three blows while he holds him (his handler's 30 at 32, 56, 96)", () => {
    const steps = heldAnims(rom, 0).m30_vegeta_9d.steps;
    expect(steps.flatMap((st, i) => (st.sfx ? [i] : []))).toEqual([2, 4, 6]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("heldByWord, on the cartridge", () => {
  it("is Shocking Stunner's drawing by character: recorded on Goku, 1a", () => {
    const rom = new Uint8Array(readFileSync(ROM_PATH));
    const hold = { table: 0x2a9354, frames: 112 };
    expect(heldByWord(rom, hold, 0).steps).toEqual([{ frame: "26", dur: 112 }]);
    expect(heldByWord(rom, hold, 9).steps).toEqual([{ frame: "88", dur: 112 }]);
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

describe.skipIf(!existsSync(ROM_PATH))("Bukuuh Kyaku's hold", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const { m30_gohan_a9: floor, m30_gohan_a9_air: air } = heldAnims(rom, 0);

  it("shows goku a drawing per step of a9, on the floor and off it, from their two tables", () => {
    expect(floor.steps.slice(0, 3).map((s) => s.frame)).toEqual(["25", "23", "25"]);
    expect(air.steps.slice(0, 3).map((s) => s.frame)).toEqual(["26", "59", "26"]);
  });

  it("lasts as long as a9: thirty steps, 73 frames", () => {
    expect(floor.steps).toHaveLength(30);
    expect(floor.steps.reduce((n, s) => n + (s.dur ?? 0), 0)).toBe(73);
  });
});
