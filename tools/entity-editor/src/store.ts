/**
 * Central editor state and mutation helpers.
 *
 * The exported shapes mirror the entity data format
 * (see docs/data-format.md): frames carry a rect + anchor, animations are
 * ordered timed steps. The editor holds a working copy; `exporter.ts` turns it
 * into the on-disk `*.entity.json`.
 */

import type { Sounds } from "../../../src/audio/sounds";
import type {
  Box,
  BoxType,
  EntityFile,
  FrameDef as FileFrame,
} from "../../../src/entity/entityFile";
import type { StatesFile } from "../../../src/entity/states";

export type { Box, BoxType };

/**
 * A frame as the editor holds it: the file's rectangle plus the id it is keyed
 * by on disk. The editor works in a list and the file is a map, so the id has to
 * travel with the rest rather than being the key.
 */
export interface FrameDef extends FileFrame {
  id: string;
}

export interface StepDef {
  frame: string;
  /** Duration in game frames at 60 FPS. */
  dur: number;
  /** Collision boxes active on this step. */
  boxes: Box[];
  /** The cartridge's sounds for this step, kept as the export wrote them. */
  sfx?: number[];
  /** The cartridge's spoken line for this step, kept as the export wrote it. */
  voice?: number;
  /** The effects its script puts out on this step, kept as the export wrote them. */
  spawns?: { name: string; at: [number, number] }[];
}

export interface AnimDef {
  name: string;
  loop: boolean;
  steps: StepDef[];
}

export interface EditorState {
  /** The sheet as the ROM draws it (`src/cartridge/romSheets.ts`). */
  image: HTMLCanvasElement | null;
  entityName: string;
  frames: FrameDef[];
  anims: AnimDef[];
  /**
   * `states.json` as loaded from disk. The States tab is **read-only** — states
   * are hand-authored for now (ADR 0013), so the editor shows and
   * validates them but never writes them.
   */
  states: StatesFile | null;
  /**
   * The entity's default hitstun, for attacks that name none of their own. Only
   * the chain graph reads it, and only so an untuned attack shows the number it
   * is actually running on rather than a blank.
   */
  baseHitstun: number;
  /** Section file `sounds.json`: this entity's own sounds, not the game's bank. */
  sounds: Sounds | null;
  /**
   * Per-section file mtime as of the last load/save. The editor is not the only
   * writer (scripts generate animations and states), so this is what lets a save
   * notice it would overwrite a newer file.
   */
  sectionMtimes: Record<string, number>;
  selectedFrameId: string | null;
  selectedAnimName: string | null;
  /** Sheet-view zoom factor. */
  scale: number;
  /** Index of the selected animation step (for box editing). */
  selectedStepIndex: number | null;
  /** Index of the selected box within the selected step. */
  selectedBoxIndex: number | null;
  /** Box type used when drawing a new box. */
  boxType: BoxType;
}

export const state: EditorState = {
  image: null,
  entityName: "entity",
  frames: [],
  anims: [],
  baseHitstun: 12,
  states: null,
  sounds: null,
  sectionMtimes: {},
  selectedFrameId: null,
  selectedAnimName: null,
  scale: 2,
  selectedStepIndex: null,
  selectedBoxIndex: null,
  boxType: "hurt",
};

// --- change notification -------------------------------------------------

type Listener = () => void;
const listeners: Listener[] = [];

export function onChange(cb: Listener): void {
  listeners.push(cb);
}

export function emitChange(): void {
  for (const cb of listeners) cb();
}

// --- lookups -------------------------------------------------------------

export function selectedFrame(): FrameDef | null {
  return state.frames.find((f) => f.id === state.selectedFrameId) ?? null;
}

export function selectedAnim(): AnimDef | null {
  return state.anims.find((a) => a.name === state.selectedAnimName) ?? null;
}

/** The animation step currently selected for box editing, or null. */
export function selectedStep(): StepDef | null {
  const anim = selectedAnim();
  const i = state.selectedStepIndex;
  if (!anim || i === null || i < 0 || i >= anim.steps.length) return null;
  return anim.steps[i];
}

// --- frames ------------------------------------------------------------------

const asNumber = (id: string): number => {
  const n = Number(id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

/** Keep the frame list in numeric order, which is the order on the sheet. */
function sortFrames(): void {
  state.frames.sort((a, b) => asNumber(a.id) - asNumber(b.id) || a.id.localeCompare(b.id));
}

// --- animation mutations -------------------------------------------------

export function addAnim(): AnimDef {
  let name = "anim";
  let n = 0;
  while (state.anims.some((a) => a.name === name)) name = `anim_${n++}`;
  const anim: AnimDef = { name, loop: true, steps: [] };
  state.anims.push(anim);
  state.selectedAnimName = name;
  return anim;
}

export function renameAnim(oldName: string, newName: string): boolean {
  if (!newName || state.anims.some((a) => a.name === newName)) return false;
  const anim = state.anims.find((a) => a.name === oldName);
  if (!anim) return false;
  anim.name = newName;
  if (state.selectedAnimName === oldName) state.selectedAnimName = newName;
  return true;
}

export function removeAnim(name: string): void {
  state.anims = state.anims.filter((a) => a.name !== name);
  if (state.selectedAnimName === name) {
    state.selectedAnimName = state.anims[0]?.name ?? null;
  }
}

// --- loading an existing entity file ----------------------------------

/** What `/api/entity` returns: the file itself, sections and all. */
export type EntityFileIn = EntityFile;

/** Hydrate editor state from an assembled entity (reverse of the exporter). */
export function loadEntity(json: EntityFileIn): void {
  state.frames = Object.entries(json.frames ?? {}).map(([id, f]) => ({
    id,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    anchor: [f.anchor[0], f.anchor[1]],
  }));
  state.anims = Object.entries(json.animations ?? {}).map(([name, a]) => ({
    name,
    loop: a.loop,
    steps: a.steps.map((s) => ({
      frame: s.frame,
      dur: s.dur,
      boxes: (s.boxes ?? []).map((b) => ({ ...b })),
      ...(s.sfx ? { sfx: [...s.sfx] } : {}),
      ...(s.voice !== undefined ? { voice: s.voice } : {}),
      ...(s.spawns ? { spawns: s.spawns.map((p) => ({ name: p.name, at: [p.at[0], p.at[1]] as [number, number] })) } : {}),
    })),
  }));
  sortFrames();
  state.states = json.states ?? null;
  state.baseHitstun = json.attributes?.hitstun ?? 12;
  state.sounds = json.sounds ?? null;
  state.selectedFrameId = null;
  state.selectedAnimName = state.anims[0]?.name ?? null;
  state.selectedStepIndex = null;
  state.selectedBoxIndex = null;
  state.entityName = json.name;
}
