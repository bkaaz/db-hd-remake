import { toFile } from "./cartridge";
import { stepStarts } from "./animation";
import type { ScriptOp } from "./script";

/**
 * Where a fighter falls once his jump attack is over. The attack's handler
 * (`$20:BABA`, the whole roster's) puts him back in the jump, move `05`, at a
 * step and frame of his own — through `$0F:B190`, which is code by character
 * rather than a table of numbers, so each entry is read by its pattern.
 */

/** The jump that every jump attack falls back into. */
export const JUMP = 0x05;

/** `$0F:B190`: a 2-byte pointer per character, into bank `$0F`. */
const BY_CHARACTER = 0x0fb190;

/** `LDA #step / STA $46,X / STA $47,X / LDA #frame / STA $44,X`. */
const PATTERN = [0xa9, null, 0x95, 0x46, 0x95, 0x47, 0xa9, null, 0x95, 0x44];

export function fallAfterJumpAttack(rom: Uint8Array, character: number): { step: number; frame: number } {
  const file = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return at;
  };
  const table = file(BY_CHARACTER);
  const at = file((BY_CHARACTER & 0xff0000) | rom[table + 2 * character] | (rom[table + 2 * character + 1] << 8));
  if (PATTERN.some((b, i) => b !== null && rom[at + i] !== b))
    throw new Error(`character ${character}: $0F:B190's entry is not a step and a frame`);
  return { step: rom[at + 1], frame: rom[at + 7] };
}

/**
 * The step of the jump's script that shows: the frame may lie past the
 * step's end, and the script steps on until it catches up — both Goku's and
 * Vegeta's land on the script's last pose, the fall.
 */
export function fallStep(ops: ScriptOp[], at: { step: number; frame: number }): number {
  const starts = stepStarts(ops);
  let step = at.step;
  while (step + 1 < starts.length && starts[step + 1] <= at.frame) step++;
  return step;
}
