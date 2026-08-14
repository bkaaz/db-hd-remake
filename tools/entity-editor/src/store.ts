/**
 * Central editor state and mutation helpers.
 *
 * The exported shapes mirror the entity data format
 * (see docs/data-format.md): frames carry a rect + anchor, animations are
 * ordered timed steps. The editor holds a working copy; `exporter.ts` turns it
 * into the on-disk `*.entity.json`.
 */

import type { StatesFile } from "../../../src/entity/states";

export type EditorMode = "frame" | "anchor" | "bg" | "detect";

export type BoxType = "hit" | "hurt" | "push";

/** A collision box on an animation step, in px relative to the frame's anchor. */
export interface Box {
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pivot in px, measured from the frame's top-left corner. */
  anchor: [number, number];
}

export interface StepDef {
  frame: string;
  /** Duration in game frames at 60 FPS. */
  dur: number;
  /** Collision boxes active on this step. */
  boxes: Box[];
}

export interface AnimDef {
  name: string;
  loop: boolean;
  steps: StepDef[];
}

export interface EditorState {
  image: HTMLImageElement | null;
  atlasFilename: string;
  entityName: string;
  frames: FrameDef[];
  anims: AnimDef[];
  /**
   * `states.json` as loaded from disk. The States tab is **read-only** — states
   * are hand-authored for now (see docs/decisions.md), so the editor shows and
   * validates them but never writes them.
   */
  states: StatesFile | null;
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
  mode: EditorMode;
  /** Background color to key out to transparency, or null for none. */
  bgColor: [number, number, number] | null;
  /** Per-channel tolerance for the background color match (0 = exact). */
  bgTolerance: number;
  /** Whether background color-keying is applied. */
  bgKeyEnabled: boolean;
  /** Auto-detection: max transparent gap (px) to still merge fragments. */
  detectGap: number;
  /** Auto-detection: minimum side (px); a frame narrower OR shorter than this is
   * dropped by "detect all" (kills 1px slivers). Magic click ignores it. */
  detectMinSide: number;
  /** Index of the selected animation step (for box editing). */
  selectedStepIndex: number | null;
  /** Index of the selected box within the selected step. */
  selectedBoxIndex: number | null;
  /** Box type used when drawing a new box. */
  boxType: BoxType;
}

export const state: EditorState = {
  image: null,
  atlasFilename: "atlas.png",
  entityName: "entity",
  frames: [],
  anims: [],
  states: null,
  sectionMtimes: {},
  selectedFrameId: null,
  selectedAnimName: null,
  scale: 2,
  mode: "frame",
  bgColor: null,
  bgTolerance: 0,
  bgKeyEnabled: false,
  detectGap: 2,
  detectMinSide: 4,
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

// --- frame mutations -----------------------------------------------------

let frameCounter = 0;

/**
 * Frame ids are plain decimal numbers ("0", "1", …) — they are positions on the
 * sheet, and a `frame_` prefix only added noise. Kept as strings because that is
 * what JSON object keys are; JS serialises integer-like keys in numeric order,
 * so frames.json always comes out sorted.
 */
export function nextFrameId(): string {
  let id: string;
  do {
    id = String(frameCounter++);
  } while (state.frames.some((f) => f.id === id));
  return id;
}

const asNumber = (id: string): number => {
  const n = Number(id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

/** Keep the frame list in numeric order, which is the order on the sheet. */
export function sortFrames(): void {
  state.frames.sort((a, b) => asNumber(a.id) - asNumber(b.id) || a.id.localeCompare(b.id));
}

/** Clear all frames and animations, and reset numbering to 0. */
export function clearAll(): void {
  state.frames = [];
  state.anims = [];
  state.selectedFrameId = null;
  state.selectedAnimName = null;
  state.selectedStepIndex = null;
  state.selectedBoxIndex = null;
  frameCounter = 0;
}

/** Create a frame from a detected rect, with a default bottom-center anchor. */
export function addFrameFromRect(r: {
  x: number;
  y: number;
  w: number;
  h: number;
}): FrameDef {
  const frame: FrameDef = {
    id: nextFrameId(),
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    anchor: [Math.round(r.w / 2), r.h],
  };
  state.frames.push(frame);
  return frame;
}

export function deleteFrame(id: string): void {
  state.frames = state.frames.filter((f) => f.id !== id);
  // Drop any animation steps that referenced the removed frame.
  for (const a of state.anims) a.steps = a.steps.filter((s) => s.frame !== id);
  if (state.selectedFrameId === id) state.selectedFrameId = null;
}

/**
 * Renumber a frame. If the number is already taken the two frames **swap** —
 * renumbering is how an ordering mistake gets fixed, and refusing would just
 * force a dance through a temporary number. Animation steps follow both ways.
 */
export function renameFrame(oldId: string, newId: string): boolean {
  if (!newId || newId === oldId) return !!newId;
  const frame = state.frames.find((f) => f.id === oldId);
  if (!frame) return false;

  const occupant = state.frames.find((f) => f.id === newId);
  frame.id = newId;
  if (occupant) occupant.id = oldId;

  for (const a of state.anims) {
    for (const s of a.steps) {
      if (s.frame === oldId) s.frame = newId;
      else if (occupant && s.frame === newId) s.frame = oldId;
    }
  }
  if (state.selectedFrameId === oldId) state.selectedFrameId = newId;
  else if (occupant && state.selectedFrameId === newId) state.selectedFrameId = oldId;
  sortFrames();
  return true;
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

export interface EntityFileIn {
  name: string;
  atlas: string;
  frames?: Record<
    string,
    { x: number; y: number; w: number; h: number; anchor: [number, number] }
  >;
  animations?: Record<
    string,
    { loop: boolean; steps: { frame: string; dur: number; boxes?: Box[] }[] }
  >;
  states?: StatesFile;
}

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
    })),
  }));
  sortFrames();
  // New frames must never reuse a number that an animation might still name,
  // so keep counting above the highest one on disk.
  frameCounter = state.frames.reduce((max, f) => Math.max(max, asNumber(f.id) + 1), 0);
  state.states = json.states ?? null;
  state.selectedFrameId = null;
  state.selectedAnimName = state.anims[0]?.name ?? null;
  state.selectedStepIndex = null;
  state.selectedBoxIndex = null;
  state.entityName = json.name;
  state.atlasFilename = json.atlas;
}
