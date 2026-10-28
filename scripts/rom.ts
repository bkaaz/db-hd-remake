/**
 * Read Goku out of the owner's cartridge (ADR 0016).
 *
 *   npm run rom -- tiles             every tile set: where it is, whether it unpacks
 *   npm run rom -- frame 4a          drawing 4a, into preview/
 *   npm run rom -- frames            draw every drawing, report what fails
 *
 * Ids are hex, as the fighter's RAM holds them: the drawing is field 0x0a
 * (src/rom/cartridge.ts), and its tile set comes from the cartridge's table.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GOKU, ROM_PATH, layoutAt, pointer, tileSetOf, tileStream } from "../src/rom/cartridge.ts";
import { decompress } from "../src/rom/decompress.ts";
import { drawFrame, readLayout, readPalette } from "../src/rom/frame.ts";
import { encodePng, type Rgba } from "../src/sprites/png.ts";

if (!existsSync(ROM_PATH)) {
  console.error(`no cartridge at ${ROM_PATH} — it is the owner's own dump (BYOA)`);
  process.exit(1);
}
const rom = new Uint8Array(readFileSync(ROM_PATH));
const [command, ...args] = process.argv.slice(2);

if (command === "tiles") {
  let ok = 0;
  let bad = 0;
  for (let i = 0; i < 0x100; i++) {
    let at: number | null;
    try {
      at = tileStream(rom, GOKU, i);
    } catch {
      console.log(`${hex(i)}  not a record — the table ends here`);
      break;
    }
    if (at === null) continue;
    try {
      const { data } = decompress(rom, at);
      console.log(`${hex(i)}  0x${at.toString(16)}  ${data.length / 32} tiles`);
      ok++;
    } catch (e) {
      console.log(`${hex(i)}  0x${at.toString(16)}  FAILED: ${(e as Error).message}`);
      bad++;
    }
  }
  console.log(`${ok} unpacked, ${bad} failed`);
} else if (command === "frame" && args.length >= 1) {
  const drawing = parseInt(args[0], 16);
  const scale = 4;
  const { image } = draw(drawing);
  mkdirSync("preview", { recursive: true });
  const out = `preview/rom-goku-${hex(drawing)}.png`;
  writeFileSync(out, encodePng(scaled(image, scale)));
  console.log(`wrote ${out} (${image.width}×${image.height}, shown ×${scale})`);
} else if (command === "frames") {
  let ok = 0;
  for (let d = 0; d < GOKU.drawings; d++) {
    if (tileSetOf(rom, GOKU, d) === null) continue;
    try {
      draw(d);
      ok++;
    } catch (e) {
      console.log(`${hex(d)}  FAILED: ${(e as Error).message}`);
    }
  }
  console.log(`${ok} drawings of ${GOKU.drawings} ids drawn`);
} else {
  console.error("usage: npm run rom -- tiles | frame <drawing> | frames   (ids in hex)");
  process.exit(1);
}

function draw(drawing: number) {
  const set = tileSetOf(rom, GOKU, drawing);
  if (set === null) throw new Error(`drawing ${hex(drawing)} is unused`);
  const at = tileStream(rom, GOKU, set);
  if (at === null) throw new Error(`drawing ${hex(drawing)} wants tile set ${hex(set)}, an unused slot`);
  return drawFrame(
    decompress(rom, at).data,
    readLayout(rom, pointer(rom, layoutAt(GOKU, drawing))),
    readPalette(rom, GOKU.palette),
  );
}

function hex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/** Nearest-neighbour upscale, over a grey ground so transparency shows. */
function scaled(img: Rgba, s: number): Rgba {
  const width = img.width * s;
  const height = img.height * s;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (Math.floor(y / s) * img.width + Math.floor(x / s)) * 4;
      const opaque = img.data[src + 3] > 0;
      data.set(opaque ? img.data.subarray(src, src + 4) : [64, 64, 64, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}
