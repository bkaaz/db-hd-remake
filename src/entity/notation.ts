import type { HitType } from "../combat/hitTypes";

/**
 * The shorthand a blow is written in when the owner describes a move: a hit
 * type's two-letter code plus **any** frame of the move — `fl30 la187`. The
 * move is the animation playing that frame (an animation is the cartridge's
 * move, ADR 0017); a drawing several moves share names all of them.
 *
 * This only reads. It answers "what could this mean" — never picks among
 * several animations on the owner's behalf.
 */

export interface NotationData {
  animations: Record<string, { steps: { frame: string }[] }>;
  states: Record<string, { anim: string; type?: string }>;
  types: Readonly<Record<string, HitType>>;
}

export interface Reading {
  token: string;
  frame: string;
  /** The hit type the code names; absent when the token was a bare frame. */
  type?: string;
  /** Animations that play the frame, and the states that play each. */
  animations: { name: string; states: string[] }[];
}

const TOKEN = /^([a-z]{2})?(\d+)$/;

/** Read one token of the shorthand, or say what is wrong with it. */
export function readToken(token: string, data: NotationData): Reading | { token: string; error: string } {
  const match = TOKEN.exec(token);
  if (!match) return { token, error: 'expected a code and a frame, like "fl30", or a bare frame' };
  const [, code, frame] = match;

  let type: string | undefined;
  if (code !== undefined) {
    type = Object.entries(data.types).find(([, t]) => t.code === code)?.[0];
    if (!type) {
      const known = Object.values(data.types).map((t) => t.code).join(", ");
      return { token, error: `no hit type has the code "${code}" (known: ${known})` };
    }
  }

  const animations = Object.entries(data.animations)
    .filter(([, a]) => a.steps.some((s) => s.frame === frame))
    .map(([name]) => ({
      name,
      states: Object.entries(data.states)
        .filter(([, s]) => s.anim === name)
        .map(([state]) => state),
    }));

  return { token, frame, type, animations };
}

/** Whether the owner has to say which: the frame is in several animations, or in none. */
export function isAmbiguous(r: Reading): boolean {
  return r.animations.length !== 1;
}
