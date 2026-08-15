import { NO_INPUT, type WorldInput } from "../entity/entity";

/**
 * The training fixture: what the second Goku does instead of thinking.
 *
 * The dummy has no input, and a dummy that never swings is one you cannot
 * practise blocking against — so on a timer it throws each attack in turn.
 * That is enough to make every reaction, spark and knockback show up. It is
 * **not** an opponent and is not pretending to be an AI; a real second player
 * on the same keyboard is Stage 3.
 */
export class TrainingFixture {
  private timer = 0;
  private next = 0;

  constructor(private readonly period = ATTACK_EVERY) {}

  /**
   * One game frame of input for the dummy.
   *
   * While switched off the timer sits at zero rather than being reset when the
   * key is pressed, so turning the fixture on always gives a full period before
   * the first swing — and nothing has to tell this object that a key was hit.
   */
  input(on: boolean): WorldInput {
    if (!on) {
      this.timer = 0;
      return NO_INPUT;
    }
    if (++this.timer < this.period) return NO_INPUT;
    this.timer = 0;
    const attack = ROTATION[this.next];
    this.next = (this.next + 1) % ROTATION.length;
    return { ...NO_INPUT, [attack]: true };
  }
}

/** Game frames between swings — 1.5 seconds, long enough to watch one land. */
const ATTACK_EVERY = 90;

const ROTATION = ["light", "medium", "heavy", "special"] as const;
