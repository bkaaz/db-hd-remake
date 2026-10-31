import { FIGHTER_FIELDS } from "./cartridge";
import type { Source, Test } from "./cpu";

/**
 * A test a handler makes on a field or one of the game's values, in words —
 * one phrase for each way out of the branch. Where the meaning is known it is
 * said ("while B + Y are held", "every 8th frame of the game"); anywhere
 * else the field and the comparison are, so a test is never dropped for
 * want of a name, only left plain.
 */

/** Field 0xEC: the buttons held, bits as the pad's (`commands.ts`). */
const HELD = 0xec;
const BUTTONS: [number, string][] = [
  [0x8000, "B"], [0x4000, "Y"], [0x0800, "↑"], [0x0400, "↓"], [0x0200, "←"], [0x0100, "→"],
  [0x0080, "A"], [0x0040, "X"], [0x0020, "L"], [0x0010, "R"],
];
/** `$74`: the game's frame count. */
const FRAME_COUNT = 0x74;

const hex = (n: number) => n.toString(16).padStart(2, "0");

function ordinal(n: number): string {
  return `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
}

/** A field by its number, and its name where the body's table has one. */
function fieldName(n: number, names: Record<number, string>): string {
  return `field ${hex(n)}${names[n] ? ` (${names[n]})` : ""}`;
}

/** The game's own values a test reads, where known. */
const GLOBALS: Record<number, string> = {
  0x30b2: "the hitstop ?",
  0x30ba: "player one's drawn effect",
  0x30ca: "player two's drawn effect",
};

/** [taken, through] for a branch on `test` of `source`, or null for a branch the flags do not decide this way. */
export function sayTest(
  mnemonic: string,
  source: Source,
  mask: number | undefined,
  test: Test,
  names: Record<number, string> = FIGHTER_FIELDS,
): [string, string] | null {
  const zero = mnemonic === "BEQ" || mnemonic === "BNE";
  const carry = mnemonic === "BCC" || mnemonic === "BCS";
  const sign = mnemonic === "BMI" || mnemonic === "BPL";
  if (!zero && !carry && !sign) return null;
  const pair = (yes: string, no: string, takenIsYes: boolean): [string, string] => (takenIsYes ? [yes, no] : [no, yes]);

  // the buttons: one bit at a time, or a set all held
  if ("field" in source && source.field === HELD && zero) {
    const bits = test.op === "bit" ? test.mask : test.op === "cmp" && mask === test.value ? mask : null;
    if (bits !== null) {
      const names = BUTTONS.filter(([b]) => bits & b).map(([, n]) => n);
      const held = test.op === "cmp" ? `while ${names.join(" + ")} held` : `while ${names.join(" or ")} held`;
      const not = test.op === "cmp" ? `unless ${names.join(" + ")} held` : `while not ${names.join(" or ")} held`;
      // BIT: Z (BEQ) is none held; CMP: Z is all held
      return pair(held, not, test.op === "cmp" ? mnemonic === "BEQ" : mnemonic === "BNE");
    }
  }
  if ("global" in source && source.global === FRAME_COUNT && zero && test.op === "bit" && ((test.mask + 1) & test.mask) === 0) {
    const nth = ordinal(test.mask + 1);
    return pair(`every ${nth} frame of the game`, `between the game's every ${nth} frames`, mnemonic === "BEQ");
  }

  const name = "field" in source ? fieldName(source.field, names) : `$${hex(source.global)}${GLOBALS[source.global] ? ` (${GLOBALS[source.global]})` : ""}`;
  const subject = mask === undefined ? name : `${name} & ${hex(mask)}`;
  if (sign) return pair(`while ${subject} is negative`, `while ${subject} is not negative`, mnemonic === "BMI");
  if (test.op === "zero" && zero) return pair(`when ${subject} is 0`, `when ${subject} is not 0`, mnemonic === "BEQ");
  if (test.op === "bit" && zero) return pair(`when ${subject} has none of ${hex(test.mask)}`, `when ${subject} has a bit of ${hex(test.mask)}`, mnemonic === "BEQ");
  if (test.op === "field" && zero) return pair(`when ${subject} equals field ${hex(test.field)}`, `when ${subject} differs from field ${hex(test.field)}`, mnemonic === "BEQ");
  if (test.op === "cmp" && zero) return pair(`when ${subject} is ${hex(test.value)}`, `when ${subject} is not ${hex(test.value)}`, mnemonic === "BEQ");
  if (test.op === "cmp" && carry) return pair(`when ${subject} is ${hex(test.value)} or more`, `when ${subject} is below ${hex(test.value)}`, mnemonic === "BCS");
  return null;
}
