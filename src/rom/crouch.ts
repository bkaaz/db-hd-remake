import { toFile } from "./cartridge";

/**
 * Where a fighter crouches again once his crouching attack is over. The
 * attack's handler (`$0F:AA60`, `94` / `95`) calls `$0F:A10D`, which sets the
 * crouch, move `03`, and starts it at a frame of the fighter's own — past most
 * of the way down, which the script shows first.
 */

/** The crouch every crouching attack returns to. */
export const CROUCH = 0x03;

const ROUTINE = 0x0fa10d;

/**
 * `LDA #03 / JSL $01:8518 / JSL $0D:D7A0 / PHX / TDC / LDA $00,X / TAX /
 * LDA table,X / PLX / STA $44,X` — the table's address is bytes 16–18.
 */
const PATTERN = [0xa9, 0x03, 0x22, 0x18, 0x85, 0x01, 0x22, 0xa0, 0xd7, 0x0d, 0xda, 0x7b, 0xb5, 0x00, 0xaa, 0xbf, null, null, null, 0xfa, 0x95, 0x44];

/** The crouch's frame a crouching attack hands back to, for `character`. */
export function crouchAfterAttack(rom: Uint8Array, character: number): number {
  const at = toFile(ROUTINE);
  if (at === null || PATTERN.some((b, i) => b !== null && rom[at + i] !== b))
    throw new Error("$0F:A10D is not the crouch's return");
  const table = toFile(rom[at + 16] | (rom[at + 17] << 8) | (rom[at + 18] << 16));
  if (table === null) throw new Error("$0F:A10D's table is not ROM");
  return rom[table + character];
}
