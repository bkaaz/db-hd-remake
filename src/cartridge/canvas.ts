import type { Rgba } from "../sprites/png";

/** A picture drawn from the ROM on a canvas of its own, for a texture or a 2D context to take. */
export function toCanvas(image: Rgba): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas;
}
