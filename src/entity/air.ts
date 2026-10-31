/**
 * What a move's handler does to a body in the air, frame by frame — a state's
 * `air`. Jumping Knee Slash leaves the ground on its frame 16 with gravity
 * off, slows its rise to a hang and falls from frame 42 (`$20:85E2`); Abiseh
 * Geri leaves on 8 and changes speed twice on the way (`$20:86CF`). A
 * `launch` cannot say either: it happens on entering, at the fighter's own
 * gravity. Pure, so the arithmetic is tested.
 */

/** What the handler sets on one frame of the state. */
export interface AirStep {
  /** Forward speed in px per frame, facing-relative like `vel`. */
  vx?: number;
  /** Vertical speed, − up. The first `vy` takes the body off the ground. */
  vy?: number;
  /** Added to vy every frame: a number, or the fighter's own. 0 is the cartridge's "no gravity" (field `0x28` bit 3). */
  gravity?: number | "own";
  /** This step's gravity only slows a rise, and the body hangs at the top (`$20:85EE`). */
  toApex?: boolean;
}

export type AirTimeline = [frame: number, step: AirStep][];

/** What an `air` timeline has set besides the speeds — what a state starts again from. */
export interface AirSetting {
  /** Off the ground because the timeline said so, not because the state is airborne. */
  aloft: boolean;
  gravity: number | "own";
  toApex: boolean;
}

/** The part of a body's motion an `air` timeline changes. */
export interface AirBody extends AirSetting {
  vx: number;
  vy: number;
}

/** How every state starts: on the ground, at the fighter's own gravity. */
export const ON_GROUND: AirSetting = { aloft: false, gravity: "own", toApex: false };

export function grounded(vx: number, vy: number): AirBody {
  return { ...ON_GROUND, vx, vy };
}

/** The body after whatever the timeline sets on `frame` of the state. */
export function applyAir(body: AirBody, timeline: AirTimeline | undefined, frame: number): AirBody {
  let next = body;
  for (const [at, step] of timeline ?? []) {
    if (at !== frame) continue;
    next = {
      vx: step.vx ?? next.vx,
      vy: step.vy ?? next.vy,
      aloft: next.aloft || step.vy !== undefined,
      gravity: step.gravity ?? next.gravity,
      // a new gravity is whole: without `toApex` it pulls both ways again
      toApex: step.toApex ?? (step.gravity !== undefined ? false : next.toApex),
    };
  }
  return next;
}

/** vy one frame later, at `own` gravity unless the body's is set. */
export function fall(body: AirBody, own: number): number {
  const g = body.gravity === "own" ? own : body.gravity;
  if (!body.toApex) return body.vy + g;
  return body.vy < 0 ? Math.min(0, body.vy + g) : body.vy;
}

/** Whether the timeline ever takes the body off the ground. */
export function leavesGround(timeline: AirTimeline | undefined): boolean {
  return (timeline ?? []).some(([, step]) => step.vy !== undefined);
}

/** What is wrong with a state's `air` as written, or null. */
export function airProblem(air: unknown): string | null {
  const example = `e.g. [[16, { "vx": 1, "vy": -7, "gravity": 0 }]]`;
  if (air === undefined) return null;
  if (!Array.isArray(air)) return `"air" must be [frame, step] pairs, ${example}`;
  let last = -1;
  for (const entry of air) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "number" || entry[0] <= last)
      return `"air" must be [frame, step] pairs with the frames rising, ${example}`;
    last = entry[0];
    const step = entry[1] as Record<string, unknown>;
    if (!step || typeof step !== "object") return `"air" at ${entry[0]}: the step must be an object`;
    for (const [key, value] of Object.entries(step)) {
      const ok =
        key === "vx" || key === "vy" ? typeof value === "number"
        : key === "gravity" ? typeof value === "number" || value === "own"
        : key === "toApex" ? typeof value === "boolean"
        : false;
      if (!ok) return `"air" at ${entry[0]}: "${key}" — vx and vy are numbers, gravity a number or "own", toApex true or false`;
    }
  }
  return null;
}
