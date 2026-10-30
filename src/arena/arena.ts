import { Sprite, Texture, type Container } from "pixi.js";
import type { Backdrop } from "../stage";
import type { ArenaFile } from "./arenaFile";

/** An arena read from disk, in one lighting: each layer's picture and how it scrolls. */
export interface LoadedArena {
  /** The lighting it was read in, and all it has — the first is the fighters' own colours. */
  time: string;
  times: string[];
  layers: { texture: Texture; scroll: [number, number] }[];
}

/**
 * Read `data/arenas/<name>/` and its pictures for `time`, the arena's first
 * lighting when none is asked for. A name or a lighting that does not exist
 * is said, not replaced by another (ADR 0008).
 */
export async function loadArena(name: string, time: string | null): Promise<LoadedArena | string> {
  const res = await fetch(`/api/arena?name=${encodeURIComponent(name)}`);
  if (!res.ok) return `no arena "${name}" — run \`npm run rom -- export\``;
  const file = (await res.json()) as ArenaFile;
  const lighting = time ?? file.times[0];
  if (!file.times.includes(lighting)) return `arena "${name}" has no time "${lighting}" — try ${file.times.join(", ")}`;
  const layers = await Promise.all(
    file.layers.map(async (layer) => ({
      texture: await picture(`/api/arena?name=${encodeURIComponent(name)}&layer=${layer.name}&time=${lighting}`),
      scroll: layer.scroll,
    })),
  );
  return { time: lighting, times: file.times, layers };
}

async function picture(url: string): Promise<Texture> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const texture = Texture.from(img);
  texture.source.scaleMode = "nearest";
  return texture;
}

/** An arena on screen: its layers back to front, each scrolling at its own speed. */
export class ArenaBackdrop implements Backdrop {
  private readonly sprites: { sprite: Sprite; scroll: [number, number] }[];

  constructor(parent: Container, arena: LoadedArena) {
    this.sprites = arena.layers.map(({ texture, scroll }) => {
      const sprite = new Sprite(texture);
      parent.addChild(sprite);
      return { sprite, scroll };
    });
  }

  scroll(x: number, y: number): void {
    for (const { sprite, scroll: [speed, offset] } of this.sprites) sprite.position.set(-(x * speed + offset), -y);
  }

  destroy(): void {
    for (const { sprite } of this.sprites) sprite.destroy({ texture: true, textureSource: true });
  }
}
