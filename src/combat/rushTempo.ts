import { SLOTS, type BlowAnim, type Picks } from "./rushSlots";

/**
 * A rush played faster or slower as a whole — the debug panel's tempo, tried
 * before a blow's own speed is written into its recipe (`slow`, `basics.json`).
 * Pure: the animations are copied, never changed.
 */

/** The tempos the panel offers: 70% to 150%, a tenth at a time, so each click shows. */
export const TEMPOS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

/** `anims` with each picked blow's steps lasting `1 / tempo` as long — whole frames, one at least. */
export function withTempo<A extends BlowAnim>(anims: Record<string, A>, picks: Picks, tempo: number): Record<string, A> {
  if (tempo === 1) return anims;
  const picked = new Set(SLOTS.flatMap((s) => (picks[s] ? [picks[s]!.anim] : [])));
  const out = { ...anims };
  for (const name of picked) {
    const anim = anims[name];
    if (anim) out[name] = { ...anim, steps: anim.steps.map((st) => ({ ...st, dur: Math.max(1, Math.round(st.dur / tempo)) })) };
  }
  return out;
}
