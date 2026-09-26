import type { WorldInput } from "../entity/entity";
import { startRecording, stopRecording } from "../log";

/**
 * The keyboard, turned into one game frame of input.
 *
 * Two kinds of key live here and they behave differently. **Directions are
 * held**: pressed stays pressed until released. **Buttons are edge-triggered**:
 * a press arms one game frame and disarms itself as soon as that frame is
 * taken, so leaning on the key does not machine-gun. Auto-repeat is ignored for
 * the same reason — one press, one attack.
 *
 * A button also reports whether it is **still down**, which is a different
 * question from whether it just went down and does not weaken the edge. A stance
 * you hold — charging ki on A+Z — cannot be expressed by edges at all: two of
 * them would have to land on the same frame, and the first to arrive alone
 * would spend itself on a punch.
 *
 * The four buttons are Burst Limit's — **Attack, Guard, Smash, Blast** (the ki
 * blast) — on the `A S` / `Z X` square that stands in for a pad's four face
 * buttons. A and S are the two that hit; Z, the guard, sits under the attack
 * so that holding both charges ki.
 *
 * Remapping comes later; nothing outside this file knows which key is which.
 */
export class Keyboard {
  /** Draw hit/hurt/push boxes over the fighters. Toggled with B. */
  showBoxes = true;
  /** Let the debug dummy play its timeline. Toggled with T. */
  dummyAttacks = false;
  /**
   * Step to the next debug mode, pressed with M.
   *
   * An edge rather than a toggle, and taken by the scene rather than read: it
   * asks for a rebuild, and a request that stayed true for a second frame would
   * ask twice.
   */
  private modeAsked = false;
  /**
   * Fill the ki meter, pressed with Space — a debug key, and the reason it is
   * an edge like M: it is asked for, not held.
   *
   * Trying a move that costs ki otherwise means holding A+Z for twenty seconds
   * first, and what is being looked at is never the charging.
   */
  private kiAsked = false;
  /** Print what the engine thinks for both fighters. Toggled with D. */
  showDebug = true;
  /** Whether a gameplay recording is running. Started and stopped with L. */
  recording = false;

  private readonly held: Directions = { left: false, right: false, up: false, down: false };
  private readonly armed: Buttons = {
    attack: false,
    guard: false,
    smash: false,
    blast: false,
  };
  private readonly down: Buttons = {
    attack: false,
    guard: false,
    smash: false,
    blast: false,
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
    const input = {
      ...this.held,
      ...this.armed,
      holding: { ...this.down },
    };
    for (const button of BUTTONS) this.armed[button] = false;
    return input;
  }

  /** True once per press of M. Taking it spends it, like an attack button. */
  takeModeStep(): boolean {
    const asked = this.modeAsked;
    this.modeAsked = false;
    return asked;
  }

  /** True once per press of Space. Taking it spends it, like an attack button. */
  takeKiRefill(): boolean {
    const asked = this.kiAsked;
    this.kiAsked = false;
    return asked;
  }

  private press(e: KeyboardEvent): void {
    const direction = DIRECTION_KEYS[e.key];
    if (direction) {
      this.held[direction] = true;
      return;
    }
    const key = e.key.toLowerCase();
    const button = BUTTON_KEYS[key];
    if (button) {
      this.down[button] = true;
      // Auto-repeat must not re-arm: holding the key is still one attack.
      if (!e.repeat) this.armed[button] = true;
      return;
    }
    if (key === " ") this.kiAsked = !e.repeat;
    else if (key === "m") this.modeAsked = !e.repeat;
    else if (key === "t") this.dummyAttacks = !this.dummyAttacks;
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
    if (direction) {
      this.held[direction] = false;
      return;
    }
    const button = BUTTON_KEYS[e.key.toLowerCase()];
    if (button) this.down[button] = false;
  }
}

type Directions = Pick<WorldInput, "left" | "right" | "up" | "down">;
type Buttons = Pick<WorldInput, "attack" | "guard" | "smash" | "blast">;

const BUTTONS = ["attack", "guard", "smash", "blast"] as const;

const DIRECTION_KEYS: Record<string, keyof Directions | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const BUTTON_KEYS: Record<string, keyof Buttons | undefined> = {
  a: "attack",
  z: "guard",
  s: "smash",
  x: "blast",
};
