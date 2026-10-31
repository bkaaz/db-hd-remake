import { readResource, resourceStream, type Load } from "./resource";

/**
 * What a VRAM snapshot holds, named in the cartridge (ADR 0036): which
 * resources lie where in OBJ VRAM, and where in the ROM a palette the
 * snapshot's CGRAM holds comes from — so the export draws an object from the
 * cartridge alone, the recording having only said which.
 */

const TILE = 32;
/** OBJ VRAM's first word ($6000), as `objectVram` lays it out. */
const OBJ = 0x6000;

/**
 * Every candidate resource found whole in `obj` (OBJ VRAM, tile 0 first),
 * where it starts. A resource is looked up by its first tile, then checked
 * to its last byte; one that does not fit or is all zero is not a match.
 */
export function matchLoads(rom: Uint8Array, obj: Uint8Array, candidates: number[]): Load[] {
  const byFirst = new Map<string, { resource: number; data: Uint8Array }[]>();
  for (const resource of candidates) {
    // a record of ff, or one that points nowhere, is no resource
    let data: Uint8Array;
    try {
      if (resourceStream(rom, resource) === null) continue;
      data = readResource(rom, resource);
    } catch {
      continue;
    }
    if (data.length < TILE || data.every((b) => b === 0)) continue;
    const key = Buffer.from(data.subarray(0, TILE)).toString("hex");
    byFirst.set(key, [...(byFirst.get(key) ?? []), { resource, data }]);
  }
  const found: Load[] = [];
  for (let at = 0; at + TILE <= obj.length; at += TILE) {
    for (const { resource, data } of byFirst.get(Buffer.from(obj.subarray(at, at + TILE)).toString("hex")) ?? []) {
      if (at + data.length > obj.length) continue;
      if (data.every((b, i) => b === obj[at + i])) found.push({ resource, vram: OBJ + at / 2 });
    }
  }
  return found;
}

/** Every ROM offset whose 32 bytes are this palette's 16 colours, as CGRAM holds them. */
export function findPalette(rom: Uint8Array, colours: Uint8Array): number[] {
  const out: number[] = [];
  const rom8 = Buffer.from(rom.buffer, rom.byteOffset, rom.byteLength);
  for (let at = rom8.indexOf(colours); at !== -1; at = rom8.indexOf(colours, at + 1)) out.push(at);
  return out;
}
