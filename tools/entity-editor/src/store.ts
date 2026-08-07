/**
 * Central editor state and mutation helpers.
 *
 * The exported shapes mirror the entity data format
 * (see docs/data-format.md): frames carry a rect + anchor, animations are
 * ordered timed steps. The editor holds a working copy; `exporter.ts` turns it
 * into the on-disk `*.entity.json`.
 */

export type EditorMode = "frame" | "anchor" | "bg" | "detect";

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
  /** Auto-detection: minimum bounding-box area (px²) to keep a frame. */
  detectMinArea: number;
}

export const state: EditorState = {
  image: null,
  atlasFilename: "atlas.png",
  entityName: "entity",
  frames: [],
  anims: [],
  selectedFrameId: null,
  selectedAnimName: null,
  scale: 2,
  mode: "frame",
  bgColor: null,
  bgTolerance: 0,
  bgKeyEnabled: false,
  detectGap: 2,
  detectMinArea: 12,
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

// --- frame mutations -----------------------------------------------------

let frameCounter = 0;

export function nextFrameId(): string {
  let id: string;
  do {
    id = `frame_${frameCounter++}`;
  } while (state.frames.some((f) => f.id === id));
  return id;
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

export function renameFrame(oldId: string, newId: string): boolean {
  if (!newId || state.frames.some((f) => f.id === newId)) return false;
  const frame = state.frames.find((f) => f.id === oldId);
  if (!frame) return false;
  frame.id = newId;
  for (const a of state.anims) {
    for (const s of a.steps) if (s.frame === oldId) s.frame = newId;
  }
  if (state.selectedFrameId === oldId) state.selectedFrameId = newId;
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
  frames: Record<
    string,
    { x: number; y: number; w: number; h: number; anchor: [number, number] }
  >;
  animations: Record<
    string,
    { loop: boolean; steps: { frame: string; dur: number }[] }
  >;
}

/** Hydrate editor state from a saved entity file (reverse of the exporter). */
export function loadEntity(json: EntityFileIn): void {
  state.frames = Object.entries(json.frames).map(([id, f]) => ({
    id,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    anchor: [f.anchor[0], f.anchor[1]],
  }));
  state.anims = Object.entries(json.animations).map(([name, a]) => ({
    name,
    loop: a.loop,
    steps: a.steps.map((s) => ({ frame: s.frame, dur: s.dur })),
  }));
  state.selectedFrameId = null;
  state.selectedAnimName = state.anims[0]?.name ?? null;
  state.entityName = json.name;
  state.atlasFilename = json.atlas;
}
