/**
 * Read Goku out of the owner's cartridge (ADR 0016).
 *
 *   npm run rom -- tiles             every tile set: where it is, whether it unpacks
 *   npm run rom -- frame 4a          drawing 4a, into preview/
 *   npm run rom -- frames            draw every drawing, report what fails
 *   npm run rom -- move 92           the animation script a move plays
 *   npm run rom -- moves             every move id whose script reads
 *   npm run rom -- export            every drawing into assets/sheets/goku.png and
 *                                    data/entities/goku/frames.json (frame n = drawing n),
 *                                    every move into its animations.json as m00…mff
 *
 * Ids are hex, as the fighter's RAM holds them: the drawing is field 0x0a
 * (src/rom/cartridge.ts), and its tile set comes from the cartridge's table.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GOKU, ROM_PATH, layoutAt, pointer, scriptAt, tileSetOf, tileStream } from "../src/rom/cartridge.ts";
import { readScript, type ScriptOp } from "../src/rom/script.ts";
import { packSheet, type Placed } from "../src/rom/sheet.ts";
import { animName, moveAnim } from "../src/rom/animation.ts";
import { readBoxes } from "../src/rom/collision.ts";
import type { Anim } from "../src/entity/entityFile.ts";
import { decompress } from "../src/rom/decompress.ts";
import { drawFrame, flipLayout, readLayout, readPalette } from "../src/rom/frame.ts";
import { PLAIN, parseFrameId, type Look } from "../src/rom/look.ts";
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
} else if (command === "move" && args.length >= 1) {
  const move = parseInt(args[0], 16);
  const at = scriptAt(rom, GOKU, move);
  console.log(`move ${hex(move)}: script at 0x${at.toString(16)}`);
  let frame = 0;
  for (const op of readScript(rom, at)) {
    console.log(`  ${String(frame).padStart(3)}  ${describe(op)}`);
    if (op.op === "show") frame += op.frames;
  }
  console.log(`  ${String(frame).padStart(3)}  end`);
} else if (command === "moves") {
  for (let move = 0; move < 0x100; move++) {
    try {
      const ops = readScript(rom, scriptAt(rom, GOKU, move));
      const frames = ops.reduce((n, op) => n + (op.op === "show" ? op.frames : 0), 0);
      const drawings = ops.flatMap((op) => (op.op === "show" && op.drawing !== null ? [hex(op.drawing)] : []));
      console.log(`${hex(move)}  ${String(frames).padStart(3)} frames  ${drawings.join(" ")}`);
    } catch (e) {
      console.log(`${hex(move)}  -- ${(e as Error).message}`);
    }
  }
} else if (command === "export") {
  // every move id, though many share a script: a state names a move, not a script
  const animations: Record<string, Anim> = {};
  for (let move = 0; move < 0x100; move++) {
    try {
      const anim = moveAnim(move, readScript(rom, scriptAt(rom, GOKU, move)), (d) => readBoxes(rom, GOKU.boxes, d));
      if (anim) animations[animName(move)] = anim;
    } catch (e) {
      console.log(`  ${animName(move)} left out: ${(e as Error).message}`);
    }
  }

  // every drawing as drawn, plus each way a move shows one (src/rom/look.ts);
  // frame ids are decimal like every other frames.json — "74" is drawing 4a
  const ids = new Set<string>();
  for (let d = 0; d < GOKU.drawings; d++) if (tileSetOf(rom, GOKU, d) !== null) ids.add(String(d));
  for (const anim of Object.values(animations)) for (const step of anim.steps) ids.add(step.frame);
  const items: Placed[] = [];
  const failed = new Set<string>();
  for (const id of [...ids].sort((a, b) => parseFrameId(a).drawing - parseFrameId(b).drawing || a.localeCompare(b))) {
    try {
      items.push({ id, ...place(id) });
    } catch (e) {
      failed.add(id);
      console.log(`  frame ${id} left out: ${(e as Error).message}`);
    }
  }
  for (const [name, anim] of Object.entries(animations)) {
    const bad = anim.steps.find((s) => failed.has(s.frame));
    if (!bad) continue;
    delete animations[name];
    console.log(`  ${name} left out: shows frame ${bad.frame}, which has no picture`);
  }
  const { sheet, frames } = packSheet(items);

  mkdirSync("data/entities/goku", { recursive: true });
  writeFileSync("assets/sheets/goku.png", encodePng(sheet));
  writeFileSync("data/entities/goku/frames.json", JSON.stringify(frames, null, 2) + "\n");
  writeFileSync("data/entities/goku/animations.json", JSON.stringify(animations, null, 2) + "\n");
  console.log(`wrote ${items.length} frames into assets/sheets/goku.png (${sheet.width}×${sheet.height}) and frames.json,`);
  console.log(`  ${Object.keys(animations).length} moves into animations.json`);
} else {
  console.error("usage: npm run rom -- tiles | frame <drawing> | frames | move <id> | moves | export   (ids in hex)");
  process.exit(1);
}

/**
 * A frame's picture and where the fighter's position falls in it: the drawing
 * mirrored about its origin, then the origin moved away from the position by
 * the offset — so the anchor is the position, as the game draws it.
 */
function place(id: string): Omit<Placed, "id"> {
  const { drawing, look } = parseFrameId(id);
  const blank = { image: { width: 1, height: 1, data: new Uint8Array(4) }, origin: { x: 0, y: 0 } };
  // a layout of no pieces is a drawing too: the invisible frame of a vanish
  const empty = readLayout(rom, pointer(rom, layoutAt(GOKU, drawing))).length === 0;
  const { image, origin } = empty ? blank : draw(drawing, look);
  return { image, origin: { x: origin.x - look.dx, y: origin.y - look.dy } };
}

function draw(drawing: number, look: Look = PLAIN) {
  const set = tileSetOf(rom, GOKU, drawing);
  if (set === null) throw new Error(`drawing ${hex(drawing)} is unused`);
  const at = tileStream(rom, GOKU, set);
  if (at === null) throw new Error(`drawing ${hex(drawing)} wants tile set ${hex(set)}, an unused slot`);
  return drawFrame(
    decompress(rom, at).data,
    flipLayout(readLayout(rom, pointer(rom, layoutAt(GOKU, drawing))), look.h, look.v),
    readPalette(rom, GOKU.palette),
  );
}

function describe(op: ScriptOp): string {
  switch (op.op) {
    case "show":
      return op.drawing === null
        ? `${op.frames} frames, keep the drawing`
        : `${op.frames} frames of ${hex(op.drawing)} (tile set ${hex(tileSetOf(rom, GOKU, op.drawing) ?? 0)})`;
    case "attack": return `attack ${hex(op.id)} ?`;
    case "effect": return `effect ${hex(op.id)} ?`;
    case "offset": return `draw ${op.dx}, ${op.dy} px from the position`;
    case "flip": return `flip ${op.h ? "h" : ""}${op.v ? "v" : ""}${op.h || op.v ? "" : "off"}`;
    case "hold": return `hold ${hex(op.drawing)} until released ?`;
    case "raw": return op.bytes.map(hex).join(" ") + "  (not read yet)";
  }
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
