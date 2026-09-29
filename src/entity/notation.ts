import type { HitType } from "../combat/hitTypes";

/**
 * The shorthand a blow is written in when the owner describes a move: a hit
 * type's two-letter code plus **any** frame of the move — `fl30 la187`. One
 * number stands for the move because the catalogue already groups frames into
 * moves (`descriptions.json`), and the sheet does not keep a move's frames in
 * order, so asking for all of them would be asking for a list typed by hand.
 *
 * This only reads. It answers "what could this mean" — never picks among
 * several animations on the owner's behalf.
 */

export interface NotationData {
  groups: Record<string, { frames: string[] }>;
  animations: Record<string, { steps: { frame: string }[] }>;
  states: Record<string, { anim: string; type?: string }>;
  types: Readonly<Record<string, HitType>>;
}

export interface Reading {
  token: string;
  frame: string;
  /** The hit type the code names; absent when the token was a bare frame. */
  type?: string;
  /** Moves in the catalogue holding the frame, with all of their frames. */
  moves: { name: string; frames: string[] }[];
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

  const moves = Object.entries(data.groups)
    .filter(([, g]) => g.frames.includes(frame))
    .map(([name, g]) => ({ name, frames: g.frames }));
  const animations = Object.entries(data.animations)
    .filter(([, a]) => a.steps.some((s) => s.frame === frame))
    .map(([name]) => ({
      name,
      states: Object.entries(data.states)
        .filter(([, s]) => s.anim === name)
        .map(([state]) => state),
    }));

  return { token, frame, type, moves, animations };
}

/**
 * Whether the owner has to say which. An existing animation is the answer when
 * it is the only one, however many moves of the catalogue hold the frame —
 * a move nested in a longer one (a kick inside the string of kicks) is the
 * usual reason for two. Only with no animation do the moves become the choice.
 */
export function isAmbiguous(r: Reading): boolean {
  return r.animations.length > 1 || (r.animations.length === 0 && r.moves.length > 1);
}
