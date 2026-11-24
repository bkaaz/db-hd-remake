import type { WorldInput } from "../entity/entity";
import type { Toggle, Toggles } from "../debug/toggles";
import { ACTIONS, bindingOf, DIRECTIONS, KEYS, type Action, type Direction } from "./layout";

/**
 * The keyboard, turned into one game frame of input; which key plays what is
 * `layout.ts`'s, and the debug keys are this file's.
 *
 * Two kinds of key live here and they behave differently. **Directions are
 * held**: pressed stays pressed until released. **Buttons are edge-triggered**:
 * a press arms one game frame and disarms itself as soon as that frame is
 * taken, so leaning on the key does not machine-gun. Auto-repeat is ignored for
 * the same reason — one press, one attack.
 *
 * A button also reports whether it is **still down**, which is a different
 * question from whether it just went down and does not weaken the edge: a
 * stance you hold — charging, the guard, a dash — is read from that.
 */
export class Keyboard {
  /**
   * Step to the next debug mode, pressed with N.
   *
   * An edge rather than a toggle, and taken by the scene rather than read: it
   * asks for a rebuild, and a request that stayed true for a second frame would
   * ask twice.
   */
  private modeAsked = false;
  /**
   * Fill both fighters' health and ki, pressed with Space — a debug key, and
   * the reason it is an edge like N: it is asked for, not held.
   *
   * Trying a move that costs ki otherwise means holding the charge for twenty
   * seconds first, and what is being looked at is never the charging.
   */
  private kiAsked = false;

  private readonly held = flags(DIRECTIONS);
  private readonly armed = flags(ACTIONS);
  private readonly down = flags(ACTIONS);

  /**
   * @param toggles the debug switches its keys flip (`TOGGLE_KEYS`) — the panel's too
   *   (`src/debug/toggles.ts`)
   */
  constructor(
    readonly toggles: Toggles,
    target: Window = window,
  ) {
    target.addEventListener("keydown", (e) => this.press(e));
    target.addEventListener("keyup", (e) => this.release(e));
    // a window that is not focused gets no keyup: what was down would stay down
    target.addEventListener("blur", () => this.releaseAll());
  }

  /**
   * Take one game frame of input.
   *
   * Taking it is what disarms the attack buttons, so this must be called once
   * per game frame and by nobody else: a frame that is never taken is a press
   * that never happens, and taking it twice spends the press on the first call.
   */
  frame(): WorldInput {
    const input = { ...this.held, ...this.armed, holding: { ...this.down } };
    for (const button of ACTIONS) this.armed[button] = false;
    return input;
  }

  /** True once per press of N. Taking it spends it, like an attack button. */
  takeModeStep(): boolean {
    const asked = this.modeAsked;
    this.modeAsked = false;
    return asked;
  }

  /** True once per press of Space. Taking it spends it, like an attack button. */
  takeRefill(): boolean {
    const asked = this.kiAsked;
    this.kiAsked = false;
    return asked;
  }

  private press(e: KeyboardEvent): void {
    const does = KEYS[e.code];
    if (isDirection(does)) {
      this.held[does] = true;
      return;
    }
    if (does) {
      this.down[does] = true;
      // Auto-repeat must not re-arm: holding the key is still one attack.
      if (!e.repeat) this.armed[does] = true;
      return;
    }
    const key = e.key.toLowerCase();
    if (key === " ") this.kiAsked = !e.repeat;
    else if (key === "n") this.modeAsked = !e.repeat;
    else if (TOGGLE_KEYS[key]) this.toggles.flip(TOGGLE_KEYS[key]);
  }

  private release(e: KeyboardEvent): void {
    const does = KEYS[e.code];
    if (isDirection(does)) this.held[does] = false;
    else if (does) this.down[does] = false;
  }

  private releaseAll(): void {
    for (const direction of DIRECTIONS) this.held[direction] = false;
    for (const button of ACTIONS) this.down[button] = false;
  }
}

function flags<K extends string>(names: readonly K[]): Record<K, boolean> {
  return Object.fromEntries(names.map((n) => [n, false])) as Record<K, boolean>;
}

function isDirection(does: Action | Direction | undefined): does is Direction {
  return (DIRECTIONS as readonly string[]).includes(does ?? "");
}

const TOGGLE_KEYS: Record<string, Toggle | undefined> = {
  b: "boxes",
  o: "readout",
  t: "dummy",
  i: "intro",
  k: "ko",
  j: "journeys",
  l: "recording",
};

/** The key that flips a switch, as the page's switch shows it. */
export function keyFor(toggle: Toggle): string {
  return (Object.keys(TOGGLE_KEYS).find((k) => TOGGLE_KEYS[k] === toggle) ?? "?").toUpperCase();
}

/** Every key that is not a switch, and what it does — the page's key sheet; the pad's button beside it. */
export function keySheet(): [key: string, does: string][] {
  return [
    ["← →", "walk"],
    ["↑", "jump"],
    ["↓", "crouch"],
    ...ACTIONS.map((a): [string, string] => {
      const { key, pad } = bindingOf(a);
      return [key, `${a} (${pad})`];
    }),
    ["N", "next debug mode"],
    ["Space", "refill health and ki"],
  ];
}
