import { Container, Sprite, Texture } from "pixi.js";
import type { Backdrop } from "../stage";
import type { ArenaFile } from "./arenaFile";
import { CycledLayer } from "./cycledLayer";
import { cartridge } from "../cartridge/romFile";
import { arenaImages } from "../cartridge/romBackdrops";
import { toCanvas } from "../cartridge/canvas";

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
  // its pictures are drawn from the cartridge (ADR 0090); arena.json says how they scroll
  const pictures = arenaImages(await cartridge(), name, lighting);
  if (!pictures) return `the cartridge holds no arena "${name}"`;
  const image = (layer: string) => {
    if (!pictures[layer]) throw new Error(`arena "${name}" draws no "${layer}" — run \`npm run rom -- export\``);
    return pictures[layer];
  };
  const cycles = (file.cycles ?? []).map((cycle, i) => ({ cycle, steps: image(`cycle${i}`) }));
  const layers = file.layers.map((layer) => {
    if (layer.numbered) {
      const cycled = new CycledLayer(image(layer.name), image(`${layer.name}-numbers`), cycles);
      return { texture: cycled.texture, scroll: layer.scroll, cycled };
    }
    const texture = Texture.from(toCanvas(image(layer.name)));
    texture.source.scaleMode = "nearest";
    return { texture, scroll: layer.scroll };
  });
  return { time: lighting, times: file.times, layers };
}

/** An arena on screen: its layers back to front, each scrolling at its own speed. */
export class ArenaBackdrop implements Backdrop {
  readonly whitens = true;
  private readonly layers: { sprite: Sprite; scroll: [number, number]; cycled?: CycledLayer }[];
  /** Under whatever its parent holds already: the flash and the fade stay over an arena that comes later. */
  private readonly root = new Container();

  /** @param shared its pictures belong to someone else (`arena/travel.ts`), who lets them go */
  constructor(
    parent: Container,
    arena: LoadedArena,
    private readonly shared = false,
  ) {
    parent.addChildAt(this.root, 0);
    this.layers = arena.layers.map(({ texture, scroll, cycled }) => {
      const sprite = new Sprite(texture);
      this.root.addChild(sprite);
      return { sprite, scroll, cycled };
    });
  }

  scroll(x: number, y: number): void {
    for (const { sprite, scroll: [speed, offset] } of this.layers) sprite.position.set(-(Math.floor(x * speed) + offset), -y);
  }

  tick(): void {
    for (const { cycled } of this.layers) cycled?.tick();
  }

  destroy(): void {
    for (const { sprite } of this.layers) sprite.destroy(this.shared ? {} : { texture: true, textureSource: true });
    this.root.destroy();
  }
}
