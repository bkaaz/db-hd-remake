/**
 * What a fighter's recording corrects in his drafted `objects.json`: the draft
 * reads an object's palette and frames from code that can be read more than one
 * way, the recording shows what the game put on screen (ADR 0036). Separate from
 * `ownObjects.ts`, which exports an object as it is written down.
 */

import type { OwnObject } from "./ownObjects";
import { fullestLife, type Life, type Snapshot } from "./recording";
import { paletteRecord } from "./resource";

/**
 * Up this long or less, a life says nothing about an object's frames: a hit or
 * the end of the recording may have cut it, so its `animations` from code stay.
 */
const TOO_SHORT = 3;

export interface Recorded {
  /** The palette record its first snapshot was drawn in. */
  palette?: number;
  /** Frames of its fullest life. */
  life?: number;
}

const kindOf = (type: number, anim: number) => `${type}/${anim}`;

/** The first palette record at this address of the cartridge, or null for colours no record holds. */
export function paletteIdAt(rom: Uint8Array, at: number): number | null {
  for (let id = 0; id < 0x400; id++) {
    try {
      if (paletteRecord(rom, id).at === at) return id;
    } catch {
      return null;
    }
  }
  return null;
}

/** Each object a recording holds, by type and animation. `paletteOf` names the colours its OBJ palette held. */
export function recordedKinds(
  lives: Life[],
  snapshots: Snapshot[],
  paletteOf: (colours: Uint8Array) => number | null,
): Map<string, Recorded> {
  const kinds = new Map<string, Recorded>();
  const entry = (kind: string) => kinds.get(kind) ?? kinds.set(kind, {}).get(kind)!;
  for (const snap of snapshots) {
    const recorded = entry(kindOf(snap.bytes[0] & 0xf, snap.bytes[1]));
    if ("palette" in recorded) continue;
    const obj = (snap.bytes[4] >> 1) & 7;
    const palette = paletteOf(snap.cgram.subarray(0x100 + 32 * obj, 0x120 + 32 * obj));
    if (palette !== null) recorded.palette = palette;
  }
  for (const { type, anim } of lives) {
    const full = fullestLife(lives, type, anim)!;
    entry(kindOf(type, anim)).life = full.to - full.from;
  }
  return kinds;
}

/**
 * His objects with the recorded palettes. With `frames`, those seen for long
 * enough also lose `animations`, so the export shows them as recorded, and are
 * named: their old `data/spawns/<name>/animations.json` has to go for it to. Not
 * the default, as frames read from an object's code outrank one life of it: a
 * loop would become that life's length (`port-move`, Final Flash's head).
 */
export function correctObjects<T extends Pick<OwnObject, "name" | "type" | "anim" | "palette" | "animations">>(
  objects: T[],
  kinds: Map<string, Recorded>,
  { frames = false }: { frames?: boolean } = {},
): { objects: T[]; asRecorded: string[] } {
  const asRecorded: string[] = [];
  const corrected = objects.map((object) => {
    const recorded = kinds.get(kindOf(object.type, object.anim));
    const next = { ...object, palette: recorded?.palette ?? object.palette };
    if (frames && (recorded?.life ?? 0) > TOO_SHORT) {
      asRecorded.push(object.name);
      delete next.animations;
    }
    return next;
  });
  return { objects: corrected, asRecorded };
}
