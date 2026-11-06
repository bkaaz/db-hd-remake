import { toFile } from "./cartridge";
import { ROSTER } from "./roster";

/** By character, a word in bank $2A: where the moves that get through a parry begin ($2A:86B1). */
const THROUGH = 0x2a86d1;
const END = 0xff;

/**
 * The moves a parry lets through, by fighter ($2A:86A0): the list a state's
 * `parry.except` carries. Read rather than copied, so a test can hold the data to it.
 */
export function parryExceptions(rom: Uint8Array): Record<string, string[]> {
  const byte = (cpu: number) => rom[toFile(cpu)!];
  return Object.fromEntries(
    ROSTER.map((name, character) => {
      const list = 0x2a0000 | byte(THROUGH + 2 * character) | (byte(THROUGH + 2 * character + 1) << 8);
      const moves: string[] = [];
      for (let at = list; byte(at) !== END; at++) moves.push(byte(at).toString(16).padStart(2, "0"));
      return [name, moves];
    }),
  );
}
