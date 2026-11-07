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
import type { CommandsFile } from "../input/command";
import type { CloseButton, StatesFile } from "./states";
import type { FollowBy } from "../fx/follow";

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
  /** He casts the floor's shadow while it shows (`entity/shadow.ts`); one painted in needs none. */
  shadow?: boolean;
}

/** One frame of an animation: which sprite, for how long, hitting what. */
export interface Step {
  frame: string;
  dur: number;
  boxes?: Box[];
  /**
   * The cartridge's sound ids its script plays as this step begins — written
   * by the export from `a0`, played through the bank's `rom` match.
   */
  /** A script's hold: until something outside it ends it. One frame here, unless he is held to it (`Entity.holdToScript`). */
  hold?: true;
  sfx?: number[];
  /** The spoken line its script starts as this step begins (`a1`), played through the fighter's `line` match. */
  voice?: number;
  /**
   * Effects its script puts out as this step begins (`b0`), at `at` sprite px
   * from the entity, x toward its facing — written by the export only for a
   * move no part of which a state fires from (Saiyan Meteor's `ae`, ADR 0018).
   */
  spawns?: { name: string; at: [number, number] }[];
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
   *
   * Bounded rather than chosen: under ~4 frames it stops registering at 60 FPS,
   * and past half the reaction it eats the reaction it exists to punctuate.
   */
  hitstop: number;
  /**
   * How much punishment the fighter takes before falling. A round lasts about a
   * dozen clean hits: roughly 16 light punches or 7 uppercuts.
   */
  health: number;
  /**
   * Taken off every blow this fighter takes, before the combo scales it — the
   * cartridge's rule (docs/rom.md, Hit data), which is why a fighter read from
   * it carries the original's raw damage. Zero for one built by hand.
   */
  defence: number;
  /**
   * Our combo rules — damage and hitstun scaling and the relaunch budget
   * (`combat.md` §3). Off for a fighter ported from the cartridge, which has
   * none, so the original's numbers hold while it is compared to the original.
   */
  comboLimits: boolean;
  /**
   * Per button, how near the opponent has to be — under this many sprite px
   * between the two anchors — for its `close:` trigger: the original's line
   * between a close and a far normal (src/rom/buttons.ts). A button left out
   * is never close.
   */
  closeRange: Partial<Record<CloseButton, number>>;
  /** How near, in sprite px, the opponent must be to be thrown — the fighter's grab range ($0D:F96F); 0 never. */
  grabRange: number;
  /**
   * The palette variants this fighter has sheets for — `<sheet>@<name>.png`,
   * written by `npm run rom -- export` — for the entity to draw from in place
   * of its own (ADR 0026).
   */
  palettes: string[];
  /** Of those, the ones burning steps through, in order ($0D:EC98). */
  burn: string[];
  /**
   * Of those, the ones an object's code steps through after its own, one
   * every 4 frames, round and round ($01:84EF): Big Bang's ball, Final
   * Flash's heads (`combat/palettes.ts`).
   */
  shimmer?: string[];
  /** The two palettes a body held by Shocking Stunner flashes in (`SHOCK`, `$20:E552`). */
  shock?: string[];
  /**
   * For an effect: whether each one is shown mirrored at random, as the
   * generated sparks are; an effect taken from the cartridge is not.
   */
  mirrors: boolean;
  /**
   * For an effect: how many copies of itself it puts out, on which step of its
   * animation, how far away (px, each axis, either side) — the original's big
   * explosions ($0F:E1A9). A copy carries one fewer.
   */
  copies: { count: number; step: number; spread: [number, number] };
  /**
   * For an effect: whether it rides on whoever put it out, on his position
   * and facing, until he leaves the animation that put it out (`fx/follow.ts`).
   * `"pose"` shows the frame his drawing names — normal Goku's hair
   * ($0F:B8F2); `"body"` plays its own animation — idle's lightning
   * ($0F:B862); `{ step: n }` shows his move's step less n, while he is in
   * the move and below its step `to` — his hair in his winning pose
   * ($0F:B8CD) and his intro ($0F:B828). False: it plays where it was put.
   */
  follows: false | FollowBy;
  /**
   * Game frames a blow holds its victim helpless when its own state does not
   * say. Twelve, which is what every reaction animation happens to last today —
   * so switching the length from the pose to the number changed nothing, which
   * is how a foundation should arrive.
   */
  hitstun: number;
  /**
   * The ki meter's capacity. A **separate** resource from health, decided
   * 2026-08-23 — see `combat.md`, which had it open.
   */
  ki: number;
}

export const DEFAULT_ATTRIBUTES: Attributes = {
  gravity: 0.3,
  landCue: 50,
  pushWidth: 30,
  hitstop: 6,
  health: 100,
  defence: 0,
  comboLimits: true,
  closeRange: {},
  grabRange: 0,
  palettes: [],
  burn: [],
  mirrors: true,
  copies: { count: 0, step: 0, spread: [0, 0] },
  follows: false,
  hitstun: 12,
  ki: 100,
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
  /** Section file `commands.json`, the cartridge fighters' only (`npm run rom -- commands`). */
  commands?: CommandsFile;
}
