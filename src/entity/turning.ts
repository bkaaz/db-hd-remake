/**
 * Turning to face the opponent, and whether the turn is a move of its own.
 * Idle, walking and the crouch play one (`turnsBy`) rather than flip on the spot. Pure.
 */

import { mayTurn, type StateDef } from "./states";

/** Which way a body in `def` faces this frame, and the state it plays the turn in, if it turned and has one. */
export function faceOpponent(
  def: StateDef,
  elapsed: number,
  x: number,
  opponentX: number | null,
  facing: 1 | -1,
): { facing: 1 | -1; turnsBy?: string } {
  if (!mayTurn(def, elapsed) || opponentX === null || opponentX === x) return { facing };
  const now = opponentX > x ? 1 : -1;
  return now !== facing && def.turnsBy ? { facing: now, turnsBy: def.turnsBy } : { facing: now };
}
