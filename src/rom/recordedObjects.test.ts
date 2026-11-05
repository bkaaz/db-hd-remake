import { describe, expect, it } from "vitest";
import { correctObjects, recordedKinds } from "./recordedObjects";
import type { Life, Snapshot } from "./recording";

function life(type: number, anim: number, frames: number, hit = false): Life {
  return { slot: 0, type, anim, from: 10, to: 10 + frames, steps: [], x: 0, y: 0, vx: 0, vy: 0, hit };
}

function snapshot(firstByte: number, anim: number, objPalette: number, marker: number): Snapshot {
  const bytes = new Uint8Array(16);
  bytes[0] = firstByte;
  bytes[1] = anim;
  bytes[4] = objPalette << 1;
  const cgram = new Uint8Array(0x200);
  cgram[0x100 + 32 * objPalette] = marker;
  return { frame: 1, slot: 0, bytes, vram: new Uint8Array(0), cgram, oam: new Uint8Array(0) };
}

const OBJECT = { name: "shot", type: 4, anim: 2, palette: 1, animations: { play: { frames: [0, 1], dur: 4, loop: false } } };

describe("recordedKinds", () => {
  it("names the palette of an object's first snapshot, from the OBJ palette its slot says", () => {
    const kinds = recordedKinds([], [snapshot(0x84, 2, 3, 7), snapshot(0x84, 2, 1, 9)], (c) => c[0]);
    expect(kinds.get("4/2")).toEqual({ palette: 7 });
  });

  it("gives no palette for colours no record holds", () => {
    const kinds = recordedKinds([], [snapshot(4, 2, 0, 7)], () => null);
    expect(kinds.get("4/2")?.palette).toBeUndefined();
  });

  it("takes the length of its fullest life: one that hit nothing, though another was longer", () => {
    const kinds = recordedKinds([life(4, 2, 50, true), life(4, 2, 20), life(4, 3, 5)], [], () => null);
    expect(kinds.get("4/2")?.life).toBe(20);
    expect(kinds.get("4/3")?.life).toBe(5);
  });
});

describe("correctObjects", () => {
  it("takes the recorded palette, and leaves one the recording has none for", () => {
    const palette = (kinds: [string, { palette?: number }][]) => correctObjects([OBJECT], new Map(kinds)).objects[0].palette;
    expect(palette([["4/2", { palette: 9 }]])).toBe(9);
    expect(palette([["4/2", {}]])).toBe(1);
    expect(palette([["5/2", { palette: 9 }]])).toBe(1);
  });

  it("keeps the frames read from code unless asked", () => {
    const { objects, asRecorded } = correctObjects([OBJECT], new Map([["4/2", { life: 400 }]]));
    expect(objects[0].animations).toEqual(OBJECT.animations);
    expect(asRecorded).toEqual([]);
  });

  it("asked, drops the animations of an object seen for more than 3 frames, and names it", () => {
    const { objects, asRecorded } = correctObjects([OBJECT], new Map([["4/2", { life: 4 }]]), { frames: true });
    expect(objects[0].animations).toBeUndefined();
    expect(asRecorded).toEqual(["shot"]);
  });

  it("keeps the animations of one seen too briefly to say", () => {
    const { objects, asRecorded } = correctObjects([OBJECT], new Map([["4/2", { life: 3 }]]), { frames: true });
    expect(objects[0].animations).toEqual(OBJECT.animations);
    expect(asRecorded).toEqual([]);
  });

  it("leaves what it was given as it was", () => {
    const given = { ...OBJECT };
    correctObjects([given], new Map([["4/2", { life: 9, palette: 9 }]]), { frames: true });
    expect(given).toEqual(OBJECT);
  });
});
