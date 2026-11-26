import type { StateDef, Transition } from "../entity/states";

/**
 * The ways into the rush from outside it, written into the states a press
 * starts from — what `withRush` lays over the common states, so a rush the
 * panel tries has them exactly as the one on disk. Each is taken out before
 * it is put back, so a slot no longer picked leaves no way in behind.
 *
 * Pure: plain data in and out.
 */

/** A direction held alone, as the specials ask for one (`combat.md`, The buttons). */
export type Aim = "back" | "fwd" | "down";

/** Smash with `aim` held alone: down-back is neither back nor down. */
export function aimed(aim: Aim): string[] {
  const others = aim === "down" ? ["!held:fwd", "!held:back"] : ["!held:down", "!held:up"];
  return [`held:${aim}`, ...others, "pressed:smash"];
}

/**
 * The way into A1c, where Attack starts A1: the same press with the opponent
 * close, ahead of it.
 */
export function closeIn(states: Record<string, StateDef>, close: string, picked: boolean): void {
  const asksA1 = (t: Transition) => t.to === "rush_1" && [t.when].flat().join() === "pressed:attack";
  rewrite(states, (t) => t.to === close, (t) => (picked && asksA1(t) ? [{ when: ["pressed:attack", "close:attack"], to: close }] : []));
}

/**
 * A direction + Smash into its ender wherever Smash alone starts a blow on
 * the ground — the standing `smash` and the crouching one alike, ahead of it
 * (owner, 2026-11-25). `enders` are every ender's name, picked or not.
 */
export function aimsIn(states: Record<string, StateDef>, aims: [to: string, aim: Aim][], enders: readonly string[]): void {
  const plain = (t: Transition) => [t.when].flat().join() === "pressed:smash" && (t.to === "smash" || t.to === "crouch_b");
  const shapes = (["back", "fwd", "down"] as const).map((a) => aimed(a).join());
  // only into an ender: back + Smash in the air is a special of his own
  rewrite(states, (t) => enders.includes(t.to) && shapes.includes([t.when].flat().join()), (t) => (plain(t) ? aims.map(([to, aim]) => ({ when: aimed(aim), to })) : []));
}

/** Every state with the transitions `gone` says taken out and those `ahead` makes put before each that is left. */
function rewrite(states: Record<string, StateDef>, gone: (t: Transition) => boolean, ahead: (t: Transition) => Transition[]): void {
  for (const [name, def] of Object.entries(states)) {
    const was = def.transitions ?? [];
    const transitions = was.filter((t) => !gone(t)).flatMap((t) => [...ahead(t), t]);
    if (JSON.stringify(transitions) !== JSON.stringify(was)) states[name] = { ...def, transitions };
  }
}
