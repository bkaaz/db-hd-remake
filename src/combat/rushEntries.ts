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
  // only where Smash alone starts a blow, and only into an ender: back + Smash
  // in the air is a special of his own, the ki charge's are `withCharge`'s
  const owns = (def: StateDef) => (def.transitions ?? []).some(plain);
  rewrite(states, (t) => enders.includes(t.to) && shapes.includes([t.when].flat().join()), (t) => (plain(t) ? aims.map(([to, aim]) => ({ when: aimed(aim), to })) : []), owns);
}

/** Frames after Attack or Smash alone starts its blow that the other button still makes the pair a throw. */
const PAIR_FRAMES = 3;

/**
 * The throw is Attack + Smash together (owner, 2026-11-26), and two keys are
 * seldom down on one frame: the other one a frame or two late turns the blow
 * the first started into the throw — A1, A1c or Smash alone, the opponent in
 * reach. None where he has no throw.
 */
export function throwIn(states: Record<string, StateDef>): void {
  const late = (button: string): Transition => ({ when: ["grab", `pressed:${button}`, `!frames:${PAIR_FRAMES}`], to: "throw" });
  const isLate = (t: Transition) => t.to === "throw" && [t.when].flat().includes(`!frames:${PAIR_FRAMES}`);
  for (const [name, other] of [["rush_1", "smash"], ["rush_1_close", "smash"], ["smash", "attack"]] as const) {
    const def = states[name];
    if (!def) continue;
    const rest = (def.transitions ?? []).filter((t) => !isLate(t));
    states[name] = { ...def, transitions: states.throw ? [late(other), ...rest] : rest };
  }
}

/** Every state `within` takes, with the transitions `gone` says taken out and those `ahead` makes put before each that is left. */
function rewrite(
  states: Record<string, StateDef>,
  gone: (t: Transition) => boolean,
  ahead: (t: Transition) => Transition[],
  within: (def: StateDef) => boolean = () => true,
): void {
  for (const [name, def] of Object.entries(states)) {
    if (!within(def)) continue;
    const was = def.transitions ?? [];
    const transitions = was.filter((t) => !gone(t)).flatMap((t) => [...ahead(t), t]);
    if (JSON.stringify(transitions) !== JSON.stringify(was)) states[name] = { ...def, transitions };
  }
}
