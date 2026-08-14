import { Rectangle, Texture } from "pixi.js";
import type { Sounds } from "../audio/sounds";
import type { StatesFile } from "./states";

/**
 * Loading side of the entity data format (docs/data-format.md). The dev-server
 * plugin assembles `data/entities/<name>/*.json` into one object at
 * `/api/entity`; here we turn that into an `EntityDef` — the immutable
 * definition (textures, animations, states) shared by every live `Entity`.
 */

export interface FrameDef {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
}

export interface Box {
  type: "hit" | "hurt" | "push";
  x: number;
  y: number;
  w: number;
  h: number;
}

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
}

export const DEFAULT_ATTRIBUTES: Attributes = {
  gravity: 0.3,
  landCue: 50,
  pushWidth: 30,
  hitstop: 6,
  health: 100,
  damage: 6,
};

interface EntityFile {
  name: string;
  atlas: string;
  frames: Record<string, FrameDef>;
  animations: Record<string, Anim>;
  /** Section file `sounds.json`, absent until authored. */
  sounds?: Sounds;
  /** Section file `states.json`, absent until authored. */
  states?: StatesFile;
  attributes?: Partial<Attributes>;
}

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

/** Fetch an entity plus its keyed atlas and build per-frame textures. */
export async function loadEntityDef(name: string): Promise<EntityDef> {
  const res = await fetch(`/api/entity?name=${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = ((await res.json()) as { entity: EntityFile }).entity;

  const atlasImg = new Image();
  atlasImg.src = `/api/atlas?name=${name}`;
  await atlasImg.decode();
  const atlas = Texture.from(atlasImg);
  atlas.source.scaleMode = "nearest";

  const frames = new Map<string, FrameTex>();
  for (const [id, f] of Object.entries(data.frames ?? {})) {
    frames.set(id, {
      tex: new Texture({ source: atlas.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }),
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
