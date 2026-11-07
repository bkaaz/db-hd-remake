import { Texture } from "pixi.js";
import type { PaletteCycle } from "./arenaFile";
import { CycledPicture } from "./cycles";

/** An image's pixels, to read. */
function pixelsOf(image: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [image.width, image.height];
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height).data;
}

/** A layer whose palettes step by themselves, on a canvas that plain code repaints (ADR 0081). */
export class CycledLayer {
  readonly texture: Texture;
  private readonly context: CanvasRenderingContext2D;
  private readonly shown: ImageData;
  private readonly painted: CycledPicture;

  constructor(picture: HTMLImageElement, numbers: HTMLImageElement, cycles: { cycle: PaletteCycle; steps: HTMLImageElement }[]) {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [picture.width, picture.height];
    this.context = canvas.getContext("2d", { willReadFrequently: true })!;
    this.context.drawImage(picture, 0, 0);
    this.shown = this.context.getImageData(0, 0, canvas.width, canvas.height);
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
