/**
 * What a charge begun in a combo does to the stunned opponent's clock (owner,
 * 2026-11-27): it stands still until the charge reaches its second level, and
 * there he is left enough to be hit by a blow let go at once. Holding on past
 * that is the attacker's risk: the clock runs again and he may get away.
 * Never a stun of its own — an opponent already free stays free. Pure.
 */

/** Asked of the opponent this frame: his clock held, and the least it is to show. */
export interface StunAsk {
  hold: boolean;
  atLeast: number;
}

export const NO_ASK: StunAsk = { hold: false, atLeast: 0 };

/** His stun after this frame, as `ask` leaves it: held, topped up, or counted down. */
export function stunAfter(stun: number, ask: StunAsk): number {
  if (stun <= 0) return 0;
  const topped = Math.max(stun, ask.atLeast);
  return ask.hold ? topped : topped - 1;
}
