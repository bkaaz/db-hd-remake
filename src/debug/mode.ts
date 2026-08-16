/**
 * A debug mode: one written-down setup for the debug scene, picked by number
 * from `data/debug.json` with `?scene=debug&mode=N`.
 *
 * **A mode is a list of differences, not a description of the world.** A key it
 * does not mention keeps whatever the scene does by default, which is what makes
 * a new mode three lines instead of a copy of the last one — and what stops the
 * file from having to be updated every time the scene gains a knob.
 *
 * Numbered rather than named, at the owner's call (`decisions.md`, 2026-08-16):
 * a number is one character to change in the address bar, and a dummy that does
 * "light, light, pause, jump in, light" has no honest name. The cost — a number
 * meaning nothing a week later — is paid by the recording printing the mode's
 * contents rather than its index, which also leaves mode 0 free to be the
 * everyday scratch setup that changes whenever it needs to.
 *
 * Pure apart from `loadMode`: the shape and the checking are testable in Node.
 */

/** Where a fighter starts, as a fraction of the stage: 0 the left wall, 1 the right. */
export interface Placement {
  at?: number;
}

export interface DebugMode {
  p1?: Placement;
  p2?: Placement;
  /** Initial value only — `B` still toggles the boxes afterwards. */
  boxes?: boolean;
  /** Initial value only — `D` still toggles the state readout. */
  debug?: boolean;
}

/** What `data/debug.json` holds. */
export interface DebugModes {
  modes: DebugMode[];
}

/** Nothing said, nothing changed — what an absent file and an empty mode mean. */
export const NO_MODE: DebugMode = {};

/**
 * Pick mode `index` out of a parsed file, or say why not.
 *
 * Loud about a bad index, quiet about an absent file: asking for `mode=3` and
 * silently getting mode 0 would send you debugging the wrong setup, while
 * running with no file at all is just the scene as it has always been.
 */
export function modeAt(file: unknown, index: number): DebugMode | string {
  if (!Number.isInteger(index) || index < 0) return `mode "${index}" is not a mode number`;
  const modes = (file as DebugModes | null)?.modes;
  if (!Array.isArray(modes)) {
    return index === 0 ? NO_MODE : `mode ${index} — data/debug.json has no modes`;
  }
  if (index >= modes.length) {
    return `no mode ${index} — data/debug.json holds ${modes.length}`;
  }
  return check(modes[index], index);
}

/**
 * The one value worth checking, because it is the one that fails silently: a
 * fighter placed outside the stage is clamped on the first resize, so a typed
 * `9.5` would look like "the mode did nothing" rather than like a mistake.
 */
function check(mode: DebugMode, index: number): DebugMode | string {
  for (const side of ["p1", "p2"] as const) {
    const at = mode[side]?.at;
    if (at === undefined) continue;
    if (typeof at !== "number" || at < 0 || at > 1) {
      return `mode ${index}: ${side}.at must be between 0 and 1 — got ${at}`;
    }
  }
  return mode;
}

/**
 * Read `data/debug.json` and pick a mode from it. Served by the dev plugin, and
 * read on every scene build so that editing a mode costs a reload rather than a
 * restart of a dev server that has been up for days.
 */
export async function loadMode(index: number): Promise<DebugMode | string> {
  const file = await fetch("/api/debug")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  return modeAt(file, index);
}
