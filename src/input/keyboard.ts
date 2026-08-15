import type { WorldInput } from "../entity/entity";
import { startRecording, stopRecording } from "../log";

/**
 * The keyboard, turned into one game frame of input.
 *
 * Two kinds of key live here and they behave differently. **Directions are
 * held**: pressed stays pressed until released. **Attacks are edge-triggered**:
 * a press arms one game frame and disarms itself as soon as that frame is
 * taken, so leaning on the key does not machine-gun. Auto-repeat is ignored for
 * the same reason — one press, one attack.
 *
 * The four attack buttons are **Light, Medium, Heavy, Special** — strength, not
 * limb — on the `A S` / `Z X` square that stands in for a pad's four face
 * buttons. Read it by **column, not by row**: the left column is the lighter
 * pair and the right the heavier, which is the rule this project already used
 * when the buttons were punch/kick, and which puts Heavy on the right the way
 * the pad does.
 *
 * Remapping comes later; nothing outside this file knows which key is which.
 */
export class Keyboard {
  /** Draw hit/hurt/push boxes over the fighters. Toggled with B. */
  showBoxes = true;
  /** Let the training fixture throw its attacks. Toggled with T. */
  dummyAttacks = false;
  /** Print what the engine thinks for both fighters. Toggled with D. */
  showDebug = true;
  /** Whether a gameplay recording is running. Started and stopped with L. */
  recording = false;

  private readonly held: Directions = { left: false, right: false, up: false, down: false };
  private readonly armed: Attacks = {
    light: false,
    medium: false,
    heavy: false,
    special: false,
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
    else if (key === "d") this.showDebug = !this.showDebug;
    else if (key === "l") this.toggleRecording();
  }

  private toggleRecording(): void {
    this.recording = !this.recording;
    if (this.recording) startRecording();
    else stopRecording();
  }

  private release(e: KeyboardEvent): void {
    const direction = DIRECTION_KEYS[e.key];
    if (direction) this.held[direction] = false;
  }
}

type Directions = Pick<WorldInput, "left" | "right" | "up" | "down">;
type Attacks = Pick<WorldInput, "light" | "medium" | "heavy" | "special">;

const ATTACK_BUTTONS = ["light", "medium", "heavy", "special"] as const;

const DIRECTION_KEYS: Record<string, keyof Directions | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const ATTACK_KEYS: Record<string, keyof Attacks | undefined> = {
  a: "light",
  z: "medium",
  s: "heavy",
  x: "special",
};
