import { Rectangle, Texture } from "pixi.js";
import type { Sounds } from "../audio/sounds";
import type { StatesFile } from "./states";
import {
  DEFAULT_ATTRIBUTES,
  type Anim,
  type Attributes,
  type Box,
  type EntityFile,
  type FrameDef,
  type Step,
} from "./entityFile";

// The on-disk shapes live one file over, PixiJS-free so the editor and the
// scripts can share them; re-exported because this is where the game reaches
// for them, and an entity's loaded form is the same data plus textures.
export type { Anim, Attributes, Box, EntityFile, FrameDef, Step };
export { DEFAULT_ATTRIBUTES };

/**
 * Loading side of the entity data format (docs/data-format.md). The dev-server
 * plugin assembles `data/entities/<name>/*.json` into one object at
 * `/api/entity`; here we turn that into an `EntityDef` — the immutable
 * definition (textures, animations, states) shared by every live `Entity`.
 *
 * The *shape* of what is on disk is `entityFile.ts`; this is the loading half.
 */

/** One frame ready to draw: sub-texture plus its pivot. */
export interface FrameTex {
  tex: Texture;
  anchor: [number, number];
  w: number;
  h: number;
}

/** An authored entity, loaded and ready to instantiate. */
export interface EntityDef {
  name: string;
  frames: Map<string, FrameTex>;
  animations: Record<string, Anim>;
  states: StatesFile | null;
  sounds: Sounds;
  attributes: Attributes;
}

/** Fetch an entity plus its sheet and build per-frame textures. */
export async function loadEntityDef(name: string): Promise<EntityDef> {
  const res = await fetch(`/api/entity?name=${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = ((await res.json()) as { entity: EntityFile }).entity;

  const sheetImg = new Image();
  sheetImg.src = `/api/sheet?name=${encodeURIComponent(data.sheet)}`;
  await sheetImg.decode();
  const sheet = Texture.from(sheetImg);
  sheet.source.scaleMode = "nearest";

  const frames = new Map<string, FrameTex>();
  for (const [id, f] of Object.entries(data.frames ?? {})) {
    frames.set(id, {
      tex: new Texture({ source: sheet.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }),
      anchor: f.anchor,
      w: f.w,
      h: f.h,
    });
  }

  return {
    name: data.name,
    frames,
    animations: data.animations ?? {},
    states: data.states ?? null,
    sounds: data.sounds ?? {},
    attributes: { ...DEFAULT_ATTRIBUTES, ...(data.attributes ?? {}) },
  };
}
