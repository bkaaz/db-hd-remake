import { toFile } from "./cartridge";

/**
 * What the player's buttons pick, as the dispatcher at `$0D:FEC8` decides it.
 * On the ground Y and B each have a close and a far move, chosen by the gap
 * between the two fighters (field 0x20) against a line of the attacker's own:
 * under it is close (`$0D:C4A1`). X and A have one move each.
 *
 * | button | down | close | far | jump, neutral | jump, moving |
 * |---|---|---|---|---|---|
 * | Y | `94` | `90` | `92` | `96` | `98` |
 * | B | `95` | `91` | `93` | `97` | `99` |
 * | X | — | `9a` | `9a` | — | — |
 * | A | — | `9b` | `9b` | — | — |
 *
 * The moves are numbers in the code, the same for every fighter; only the
 * lines are data, which is all this module reads.
 */

/** `$3D:9EDB`: two bytes per fighter — the close line for Y, then for B. */
const CLOSE_LINES = 0x3d9edb;

/** The gap, in px, under which Y and B pick their close move. */
export function closeLines(rom: Uint8Array, character: number): { y: number; b: number } {
  const at = toFile(CLOSE_LINES);
  if (at === null) throw new Error("the close lines are not ROM");
  return { y: rom[at + 2 * character], b: rom[at + 2 * character + 1] };
}
