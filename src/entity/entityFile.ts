/**
 * The shape of an entity on disk, and the only declaration of it.
 *
 * `data/entities/<name>/` is a directory of section files that four different
 * programs read and write: the game, the entity editor, the dev-server plugin
 * that assembles them, and the CLI scripts. Each of them used to declare the
 * shape again — five copies of `Box`, three of `Step`, two whole entity files —
 * and they had already drifted. `DerivedBox` in `sprites/boxes.ts` could not
 * express a push box, so `npm run anim` would have dropped one silently; the
 * editor's `attributes` named one field out of seven and repeated its default as
 * a literal.
 *
 * Nothing here touches PixiJS, so the editor can import it — that is the whole
 * reason it is not in `entityDef.ts`, which owns the *loaded* form: the same
 * data with textures built from it.
 *
 * Prose about the format lives in `docs/data-format.md`, and only what a type
 * cannot say: which file holds which section, and who is allowed to write it.
 */

import type { Sounds } from "../audio/sounds";
import type { StatesFile } from "./states";

/** What a box does when it overlaps: strike, be struck, or keep bodies apart. */
export type BoxType = "hit" | "hurt" | "push";

/** A rectangle on an animation step, in sprite px **relative to the anchor**. */
export interface Box {
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One frame's rectangle on the sheet, plus where the body is pinned to it. */
export interface FrameDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pivot in px from the frame's top-left corner. */
  anchor: [number, number];
}

/** One frame of an animation: which sprite, for how long, hitting what. */
export interface Step {
  frame: string;
  dur: number;
  boxes?: Box[];
}

export interface Anim {
  loop: boolean;
  steps: Step[];
}

/** Section file `attributes.json` — constants that belong to the fighter. */
export interface Attributes {
  /** Downward acceleration in sprite px per game frame, squared. */
  gravity: number;
  /**
   * How far above the ground, in sprite px, a falling entity starts its landing
   * pose. Roughly the distance covered by the landing animation, so the pose
   * finishes as the feet touch instead of flashing after the fact.
   */
  landCue: number;
  /**
   * Width of the body for push collision, in sprite px, centred on the anchor.
   * Deliberately one number rather than per-frame boxes — see src/combat/push.ts.
   */
  pushWidth: number;
  /**
   * Game frames both fighters are frozen for when a blow connects — the pause
   * that makes a hit feel like it met something instead of passing through.
   * An attack state may override it with its own `hitstop`.
   */
  hitstop: number;
  /**
   * How much punishment the fighter takes before falling. A round lasts about a
   * dozen clean hits: roughly 16 light punches or 7 uppercuts.
   */
  health: number;
  /**
   * Damage an attack does when its own state does not say. A blow that forgot
   * to state its worth should still cost something, or a missing field would
   * silently make a move free.
   */
  damage: number;
  /**
   * Game frames a blow holds its victim helpless when its own state does not
   * say. Twelve, which is what every reaction animation happens to last today —
   * so switching the length from the pose to the number changed nothing, which
   * is how a foundation should arrive.
   */
  hitstun: number;
}

export const DEFAULT_ATTRIBUTES: Attributes = {
  gravity: 0.3,
  landCue: 50,
  pushWidth: 30,
  hitstop: 6,
  health: 100,
  damage: 6,
  hitstun: 12,
};

/**
 * One entity as the dev-server plugin assembles it from its section files.
 *
 * Everything but the name and the sheet is optional, because an entity is
 * authored a section at a time and the editor opens half-built ones — the game
 * defaults what is missing rather than refusing to load it.
 */
export interface EntityFile {
  name: string;
  /** Path under `assets/sheets/`, which the server resolves — `spawns/` and all. */
  sheet: string;
  frames?: Record<string, FrameDef>;
  animations?: Record<string, Anim>;
  /** Section file `sounds.json`, absent until authored. */
  sounds?: Sounds;
  /** Section file `states.json`, absent until authored. */
  states?: StatesFile;
  attributes?: Partial<Attributes>;
}
