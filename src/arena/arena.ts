import { Sprite, Texture, type Container } from "pixi.js";
import type { Backdrop } from "../stage";
import type { ArenaFile } from "./arenaFile";
import { CycledLayer } from "./cycledLayer";

/** An arena read from disk, in one lighting: each layer's picture and how it scrolls. */
export interface LoadedArena {
  /** The lighting it was read in, and all it has. */
  time: string;
  times: string[];
  layers: { texture: Texture; scroll: [number, number]; cycled?: CycledLayer }[];
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
  const image = (layer: string) => picture(`/api/arena?name=${encodeURIComponent(name)}&layer=${layer}&time=${lighting}`);
  const cycles = await Promise.all((file.cycles ?? []).map(async (cycle, i) => ({ cycle, steps: await image(`cycle${i}`) })));
  const layers = await Promise.all(
    file.layers.map(async (layer) => {
      if (layer.numbered) {
        const cycled = new CycledLayer(await image(layer.name), await image(`${layer.name}-numbers`), cycles);
        return { texture: cycled.texture, scroll: layer.scroll, cycled };
      }
      const texture = Texture.from(await image(layer.name));
      texture.source.scaleMode = "nearest";
      return { texture, scroll: layer.scroll };
    }),
  );
  return { time: lighting, times: file.times, layers };
}

async function picture(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/** An arena on screen: its layers back to front, each scrolling at its own speed and wrapping as a BG does. */
export class ArenaBackdrop implements Backdrop {
  readonly whitens = true;
  private readonly layers: { sprites: [Sprite, Sprite]; width: number; scroll: [number, number]; cycled?: CycledLayer }[];

  constructor(parent: Container, arena: LoadedArena) {
    this.layers = arena.layers.map(({ texture, scroll, cycled }) => {
      const sprites: [Sprite, Sprite] = [new Sprite(texture), new Sprite(texture)];
      parent.addChild(...sprites);
      return { sprites, width: texture.width, scroll, cycled };
    });
  }

  scroll(x: number, y: number): void {
    for (const { sprites: [sprite, wrapped], width, scroll: [speed, offset] } of this.layers) {
      const left = ((Math.floor(x * speed) + offset) % width + width) % width;
      sprite.position.set(-left, -y);
      wrapped.position.set(width - left, -y);
    }
  }

  tick(): void {
    for (const { cycled } of this.layers) cycled?.tick();
  }

  destroy(): void {
    for (const { sprites: [sprite, wrapped] } of this.layers) {
      wrapped.destroy();
      sprite.destroy({ texture: true, textureSource: true });
    }
  }
}
