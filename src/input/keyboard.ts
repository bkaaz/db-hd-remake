import type { WorldInput } from "../entity/entity";

/**
 * The keyboard, turned into one game frame of input.
 *
 * Two kinds of key live here and they behave differently. **Directions are
 * held**: pressed stays pressed until released. **Attacks are edge-triggered**:
 * a press arms one game frame and disarms itself as soon as that frame is
 * taken, so leaning on the key does not machine-gun. Auto-repeat is ignored for
 * the same reason — one press, one attack.
 *
 * Layout follows the ZSNES default (A=X, B=Z, X=S, Y=A), in the usual diamond:
 * top row punches, bottom row kicks, left column light, right column heavy.
 * Remapping comes later.
 */
export class Keyboard {
  /** Draw hit/hurt/push boxes over the fighters. Toggled with B. */
  showBoxes = true;
  /** Let the training fixture throw its attacks. Toggled with T. */
  dummyAttacks = false;

  private readonly held: Directions = { left: false, right: false, up: false, down: false };
  private readonly armed: Attacks = {
    punch: false,
    kick: false,
    punchHeavy: false,
    kickHeavy: false,
  };

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => this.press(e));
    target.addEventListener("keyup", (e) => this.release(e));
  }

  /**
   * Take one game frame of input.
   *
   * Taking it is what disarms the attack buttons, so this must be called once
   * per game frame and by nobody else: a frame that is never taken is a press
   * that never happens, and taking it twice spends the press on the first call.
   */
  frame(): WorldInput {
    const input = { ...this.held, ...this.armed };
    for (const button of ATTACK_BUTTONS) this.armed[button] = false;
    return input;
  }

  private press(e: KeyboardEvent): void {
    const direction = DIRECTION_KEYS[e.key];
    if (direction) {
      this.held[direction] = true;
      return;
    }
    const key = e.key.toLowerCase();
    const attack = ATTACK_KEYS[key];
    if (attack) {
      // Auto-repeat must not re-arm: holding the key is still one attack.
      if (!e.repeat) this.armed[attack] = true;
      return;
    }
    if (key === "t") this.dummyAttacks = !this.dummyAttacks;
    else if (key === "b") this.showBoxes = !this.showBoxes;
  }

  private release(e: KeyboardEvent): void {
    const direction = DIRECTION_KEYS[e.key];
    if (direction) this.held[direction] = false;
  }
}

type Directions = Pick<WorldInput, "left" | "right" | "up" | "down">;
type Attacks = Pick<WorldInput, "punch" | "kick" | "punchHeavy" | "kickHeavy">;

const ATTACK_BUTTONS = ["punch", "kick", "punchHeavy", "kickHeavy"] as const;

const DIRECTION_KEYS: Record<string, keyof Directions | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const ATTACK_KEYS: Record<string, keyof Attacks | undefined> = {
  a: "punch",
  z: "kick",
  s: "punchHeavy",
  x: "kickHeavy",
};
