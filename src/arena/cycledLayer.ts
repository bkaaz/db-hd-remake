import { Texture } from "pixi.js";
import type { PaletteCycle } from "./arenaFile";
import { CycledPicture } from "./cycles";
import type { Rgba } from "../sprites/png";

/** A picture's pixels, to read. */
const pixelsOf = (image: Rgba): Uint8ClampedArray<ArrayBuffer> => new Uint8ClampedArray(image.data);

/** A layer whose palettes step by themselves, on a canvas that plain code repaints (ADR 0081). */
export class CycledLayer {
  readonly texture: Texture;
  private readonly context: CanvasRenderingContext2D;
  private readonly shown: ImageData;
  private readonly painted: CycledPicture;

  constructor(picture: Rgba, numbers: Rgba, cycles: { cycle: PaletteCycle; steps: Rgba }[]) {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [picture.width, picture.height];
    this.context = canvas.getContext("2d", { willReadFrequently: true })!;
    this.shown = new ImageData(pixelsOf(picture), picture.width, picture.height);
    this.context.putImageData(this.shown, 0, 0);
    this.painted = new CycledPicture(
      this.shown.data,
      pixelsOf(numbers),
      cycles.map(({ cycle, steps }) => ({ cycle, steps: pixelsOf(steps) })),
    );
    this.texture = Texture.from(canvas);
    this.texture.source.scaleMode = "nearest";
  }

  tick(): void {
    if (!this.painted.tick()) return;
    this.context.putImageData(this.shown, 0, 0);
    this.texture.source.update();
  }
}
