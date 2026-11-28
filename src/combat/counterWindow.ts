import type { StateDef } from "../entity/states";
import type { CounterState } from "./counter";

/**
 * What arms a counter, and for how long (owner, 2026-11-28; `combat.md` §5).
 * On his feet, guard with a direction: towards strikes, away does not. Reeling
 * or in an exchange, where sides change too fast to tell, guard alone, and it
 * strikes. A window that runs out unmet locks the next press out a while: a
 * counter is timed, not mashed. Pure.
 */

/** Where a counter is armed from: on his feet, guarding or in the air; reeling from a blow; or a blow of his countered, against the counter's. */
export type CounterFrom = "neutral" | "reaction" | "exchange";
/** Frames a press stays armed, by where from: a blow landing in them is countered. */
export const COUNTER_WINDOW: Record<Exclude<CounterFrom, "exchange">, number> = { neutral: 9, reaction: 8 };
/** An exchange's windows, by which counter of it this is (the first is neutral's or a reaction's): shorter each time, and none past the last. */
const EXCHANGE_WINDOW = [0, 0, 6, 4];
/** Fatigue a counter costs (`combat/fatigue.ts`): about a combo's worth, escaping one. */
export const COUNTER_FATIGUE: Record<CounterFrom, number> = { neutral: 15, reaction: 25, exchange: 15 };
/** Frames after a window ran out unmet in which a press arms nothing, unless the debug bar says otherwise. */
export const COUNTER_LOCKOUT = 20;
/** The rush's flinch, standing and crouching: a rush that lands lands whole, no counter out of it. */
const RUSH_FLINCH = new Set(["hurt_chain", "hurt_crouch"]);

/** What a press arms: where from, for its cost, and for how long. */
export interface CounterArm {
  from: CounterFrom;
  window: number;
}

/** This frame's hands, as the counter reads them: guard, and the direction towards or away from him. */
export interface CounterHands {
  guardPressed: boolean;
  guardHeld: boolean;
  towards: boolean;
  away: boolean;
}

/**
 * Guard pressed, or a direction pressed with guard held (guarding, a direction
 * as the blow comes), armed for its window: the state a blow landing meanwhile
 * sends him into, or none.
 */
export class CounterWindow {
  private to: CounterState | null = null;
  private left = 0;
  private locked = 0;
  private was = { towards: false, away: false };
  /** Where the armed one was armed from, for what it costs. */
  from: CounterFrom = "neutral";
  /** Frames a window run out unmet locks the next press out (`COUNTER_LOCKOUT`); 0, never. */
  lockout = COUNTER_LOCKOUT;

  /** This frame's hands; nothing where he may not (`arm` null), nor locked out. */
  read({ guardPressed, guardHeld, towards, away }: CounterHands, arm: CounterArm | null): void {
    const newly = (towards && !this.was.towards) || (away && !this.was.away);
    this.was = { towards, away };
    // armed already, a press does not draw it out: mashed, it runs out all the same
    if (arm === null || this.to !== null || this.locked > 0 || !(guardPressed || (guardHeld && newly))) return;
    if (arm.from !== "neutral") this.to = "counter";
    else if (towards !== away) this.to = towards ? "counter" : "counter_away";
    else return;
    this.left = arm.window;
    this.from = arm.from;
  }

  /** One frame gone: a window run out unmet shuts, and locks the next press out. */
  tick(): void {
    if (this.locked > 0) this.locked--;
    if (this.left > 0 && --this.left === 0) {
      this.to = null;
      this.locked = this.lockout;
    }
  }

  /** The counter a blow landing now meets, if armed. */
  get armed(): CounterState | null {
    return this.to;
  }

  /** Spent: a blow met it, and nothing is locked out. */
  clear(): void {
    this.to = null;
    this.left = 0;
  }
}

/**
 * Where a body in state `name` may arm a counter from, or null: on his feet
 * or in the air, guarding or not; reeling, but not from the rush's flinch;
 * never in an attack or a vanish, nor down or getting up (untouchable).
 */
export function counterFrom(name: string, def: StateDef | undefined): Exclude<CounterFrom, "exchange"> | null {
  if (!def || def.hidden || def.invulnerable) return null;
  const rank = def.rank ?? 0;
  if (rank === 0) return !def.damage && def.type === undefined ? "neutral" : null;
  return rank <= 3 && !RUSH_FLINCH.has(name) ? "reaction" : null;
}

/**
 * What a press arms in state `name`: where its blow was countered, a counter
 * of the counter coming — the next of an exchange whose last was the
 * opponent's `foeCounter`th, none past the third; elsewhere where
 * `counterFrom` says.
 */
export function armFor(name: string, def: StateDef | undefined, countered: boolean, foeCounter: number): CounterArm | null {
  if (countered) {
    const window = EXCHANGE_WINDOW[foeCounter + 1] ?? 0;
    return foeCounter > 0 && window > 0 ? { from: "exchange", window } : null;
  }
  const from = counterFrom(name, def);
  return from && { from, window: COUNTER_WINDOW[from] };
}
