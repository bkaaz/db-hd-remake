import { toFile } from "./cartridge";
import type { StatesFile } from "../entity/states";

/**
 * The two things the shared knockdown code looks up by character: both are the
 * same code for every fighter, so they cannot live in the template's numbers.
 * Goku's own file carries his by hand (`knockdown.test.ts` holds it to these).
 */

/** Words by character, in 256ths: what `$0D:CB12` adds to vy in place of field `0x86` while the move is `1e`. */
const HIGH_GRAVITY = 0x0dcb33;
/** Bytes by character: in `1f` he turns and reads buttons past this step (`$0F:A38B`) — always his last. */
const GET_UP_STEP = 0x0fa3b4;

const HIGH_KNOCKDOWN = ["reel_high", "high_fall", "high_bounce"];
const GETTING_UP = ["get_up", "downed"];

export function highGravity(rom: Uint8Array, character: number): number {
  const at = toFile(HIGH_GRAVITY + 2 * character);
  if (at === null) throw new Error("the high knockdown's gravity is not ROM");
  return (rom[at] | (rom[at + 1] << 8)) / 256;
}

/** The frame of his `1f` that frees him: the start of the step past his byte, from the steps' lengths. */
export function getUpFrame(rom: Uint8Array, character: number, durs: number[]): number {
  const at = toFile(GET_UP_STEP + character);
  if (at === null) throw new Error("the get-up's step is not ROM");
  const step = rom[at] + 1;
  if (step >= durs.length) throw new Error(`his get-up has ${durs.length} steps, none past ${rom[at]}`);
  return durs.slice(0, step).reduce((sum, dur) => sum + dur, 0);
}

export function withKnockdown(states: StatesFile["states"], gravity: number, freeFrom: number): StatesFile["states"] {
  const out = { ...states };
  for (const name of HIGH_KNOCKDOWN) if (out[name]) out[name] = { ...out[name], air: [[0, { gravity }]] };
  for (const name of GETTING_UP) {
    const def = out[name];
    if (def?.inputsOf) out[name] = { ...def, turnFrom: freeFrom, inputsOf: { ...def.inputsOf, from: freeFrom } };
  }
  return out;
}
