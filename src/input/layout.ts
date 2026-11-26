/**
 * Which key and which pad button play which part of the fight — the only file
 * that knows. Burst Limit's layout on an Xbox pad, and on the keyboard the way
 * emulators lay a pad out: the arrows for the d-pad, the four face buttons as
 * the same diamond on Z X A S, the bumpers on Q W (RetroArch's defaults;
 * `docs/inspiration.md`, `combat.md` The buttons).
 *
 * Data, not code, so a remapping screen only has to write two tables.
 */

import type { Held } from "../entity/states";

/** A button of the fight, as the states read it (`held:`, `pressed:`). */
export type Action = keyof Held;
export type Direction = "left" | "right" | "up" | "down";
export const ACTIONS = ["attack", "guard", "smash", "blast", "strike", "dash", "charge", "boost"] as const satisfies readonly Action[];
export const DIRECTIONS = ["left", "right", "up", "down"] as const satisfies readonly Direction[];

/**
 * By `KeyboardEvent.code`, the key's place rather than its letter: Z is
 * bottom-left on a QWERTZ board too, where its letter is Y.
 */
export const KEYS: Record<string, Action | Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyZ: "guard", // A
  KeyX: "blast", // B
  KeyA: "attack", // X
  KeyS: "smash", // Y
  // no key for the dash: forward or back tapped twice (`doubleTap.ts`, owner 2026-11-26)
  KeyQ: "charge", // LB
  KeyW: "boost", // RB
  KeyE: "strike", // LT, until the original's moves on its X are ours
};

/**
 * By the Gamepad API's standard mapping, which numbers a pad by position the
 * way an Xbox pad is laid out: 0 is the bottom face button on any pad, ✕ on a
 * PlayStation one. The left stick counts as the d-pad (`pad.ts`).
 */
export const PAD_BUTTONS: Record<number, Action | Direction> = {
  0: "guard", // A
  1: "blast", // B
  2: "attack", // X
  3: "smash", // Y
  4: "charge", // LB
  5: "boost", // RB
  6: "strike", // LT
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

/** The pad's names for its buttons, for the key sheet. */
const PAD_NAMES: Record<number, string> = { 0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT", 9: "Start" };

/** The key and the pad button that play an action, as a person reads them. */
export function bindingOf(action: Action): { key: string; pad: string } {
  const code = Object.keys(KEYS).find((k) => KEYS[k] === action);
  const button = Object.keys(PAD_BUTTONS).find((b) => PAD_BUTTONS[Number(b)] === action);
  return {
    key: code ? code.replace(/^Key/, "") : "?",
    pad: button !== undefined ? (PAD_NAMES[Number(button)] ?? `#${button}`) : "?",
  };
}
