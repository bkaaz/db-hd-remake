import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import { ditherKeeps, DITHER_LEVELS } from "./dither";

/**
 * A vanish drawn as the SNES draws one: the body's drawing thinned into a
 * lattice of pixels (`dither.ts`) — left behind where he was as he goes, and
 * built up again where he comes out. No picture of its own, so every pose of
 * every fighter has it (owner, 2026-11-26).
 */

const made = new WeakMap<Texture, Map<number, Texture>>();

/** `tex` with only the pixels `level` of `DITHER_LEVELS` keeps, made once and kept. */
export function dithered(tex: Texture, level: number): Texture {
  if (level >= DITHER_LEVELS) return tex;
  let levels = made.get(tex);
  if (!levels) made.set(tex, (levels = new Map()));
  const known = levels.get(level);
  if (known) return known;
  const canvas = tex.source.resource as HTMLCanvasElement | undefined;
  const { x, y, width: w, height: h } = tex.frame;
  const out = document.createElement("canvas");
  [out.width, out.height] = [Math.max(1, w), Math.max(1, h)];
  const pen = out.getContext("2d");
  if (canvas?.getContext && pen) {
    const pixels = canvas.getContext("2d")!.getImageData(x, y, w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (!ditherKeeps(level, px, py)) pixels.data[(py * w + px) * 4 + 3] = 0;
    pen.putImageData(pixels, 0, 0);
  }
  const thinned = Texture.from(out);
  thinned.source.scaleMode = "nearest";
  const result = new Texture({ source: thinned.source, frame: new Rectangle(0, 0, w, h) });
  levels.set(level, result);
  return result;
}

/** Frames a body left behind takes to thin away to nothing, and one coming out to build up whole. */
export const AFTERIMAGE_FRAMES = 8;
export const APPEAR_FRAMES = 6;

/** What a body leaves where it vanished: its drawing as it last was, thinning away. */
export class Afterimage {
  private readonly ghost = new Sprite();
  private readonly base: Texture;
  private left = AFTERIMAGE_FRAMES;

  constructor(
    private readonly into: Container,
    body: Sprite,
  ) {
    this.ghost.texture = body.texture;
    this.ghost.anchor.copyFrom(body.anchor);
    this.ghost.scale.copyFrom(body.scale);
    this.ghost.position.copyFrom(body.position);
    this.base = body.texture;
    into.addChild(this.ghost);
  }

  /** A frame of the fight: thinner, or gone; false once gone. */
  tick(): boolean {
    this.left--;
    if (this.left <= 0) {
      this.into.removeChild(this.ghost);
      this.ghost.destroy();
      return false;
    }
    this.ghost.texture = dithered(this.base, Math.round((this.left / AFTERIMAGE_FRAMES) * DITHER_LEVELS));
    return true;
  }
}
