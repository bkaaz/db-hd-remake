import { toFile } from "./cartridge";

/**
 * Where `$0D:DE9A` puts an opponent it holds (move 30) — the throw's: at the
 * mover's whole-pixel x and y plus an offset from the handler's table, which
 * holds one 2-byte pointer per opponent's character (same bank), each to a
 * signed (dx, dy) word pair per step of the mover's script. dx is mirrored
 * when the mover faces left.
 */
export function holdOffsets(rom: Uint8Array, table: number, opponent: number, steps: number): [number, number][] {
  const at = (address: number) => {
    const off = toFile(address);
    if (off === null) throw new Error(`${address.toString(16)} is not ROM`);
    return off;
  };
  const word = (address: number) => rom[at(address)] | (rom[at(address + 1)] << 8);
  const signed = (n: number) => (n << 16) >> 16;
  const list = (table & 0xff0000) | word(table + 2 * opponent);
  return Array.from({ length: steps }, (_, s) => [signed(word(list + 4 * s)), signed(word(list + 4 * s + 2))]);
}
