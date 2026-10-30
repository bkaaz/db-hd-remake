/**
 * Read Goku out of the owner's cartridge (ADR 0016).
 *
 *   npm run rom -- tiles             every tile set: where it is, whether it unpacks
 *   npm run rom -- frame 4a          drawing 4a, into preview/
 *   npm run rom -- frames            draw every drawing, report what fails
 *   npm run rom -- move 92           the animation script a move plays
 *   npm run rom -- moves             every move id whose script reads
 *   npm run rom -- port a5           all the cartridge says about one move, per part
 *   npm run rom -- object a 13 32@6c00 [80]
 *                                    an object's frames into preview/, drawn from
 *                                    resources loaded where the game loads them
 *                                    (resource@vram), tile base in tiles, palette of
 *                                    the first resource
 *   npm run rom -- export            every drawing into assets/sheets/goku.png and
 *                                    data/entities/goku/frames.json (frame n = drawing n),
 *                                    every move into its animations.json as m00…mff
 *
 * Ids are hex, as the fighter's RAM holds them: the drawing is field 0x0a
 * (src/rom/cartridge.ts), and its tile set comes from the cartridge's table.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GOKU, ROM_PATH, scriptAt, tileSetOf, tileStream } from "../src/rom/cartridge.ts";
import { readScript, type ScriptOp } from "../src/rom/script.ts";
import { decompress } from "../src/rom/decompress.ts";
import { drawDrawing, exportFighter, exportSpawns, type Exported } from "../src/rom/export.ts";
import { encodePng, type Rgba } from "../src/sprites/png.ts";
import { portReport } from "../src/rom/port.ts";
import { long } from "../src/rom/disasm.ts";
import { objectFrame } from "../src/rom/object.ts";
import { objectVram, resourcePalette } from "../src/rom/resource.ts";
import { drawFrame, readLayout, readPalette } from "../src/rom/frame.ts";

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
  const { image } = drawDrawing(rom, GOKU, drawing);
  mkdirSync("preview", { recursive: true });
  const out = `preview/rom-goku-${hex(drawing)}.png`;
  writeFileSync(out, encodePng(scaled(image, scale)));
  console.log(`wrote ${out} (${image.width}×${image.height}, shown ×${scale})`);
} else if (command === "frames") {
  let ok = 0;
  for (let d = 0; d < GOKU.drawings; d++) {
    if (tileSetOf(rom, GOKU, d) === null) continue;
    try {
      drawDrawing(rom, GOKU, d);
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
} else if (command === "port" && args.length >= 1) {
  const r = portReport(rom, GOKU, parseInt(args[0], 16));
  console.log(`move ${hex(r.move)} — handler ${long(r.handler)}`);
  console.log(`input: ${r.inputs.join(" | ") || "none from a button or a command"}`);
  console.log("frames count from each part's start; sounds are the cartridge's ids, not clips");
  for (const p of r.parts) {
    const blow = p.blow ? `blow at ${p.blow.frame}: ${p.blow.type}, damage ${p.blow.damage}, stun ${p.blow.stun}` : "no blow";
    const speed = [`vel ${p.vel}`, ...p.velAt.map(([f, v]) => `${f}: ${v}`)].join(", ");
    console.log(`\n${p.anim}  (move frames ${p.from}–${p.from + p.frames - 1})`);
    console.log(`  ${blow}`);
    console.log(`  speed: ${speed}`);
    if (p.sounds.length)
      console.log(`  sounds: ${p.sounds.map((s) => `${s.frame}: ${hex(s.id)}${s.handler ? " (handler)" : ""}`).join(", ")}`);
    for (const s of p.spawns)
      console.log(`  spawns at ${s.frame}: object ${hex(s.type)}/${hex(s.anim)} — its blow ${s.blow.type}, damage ${s.blow.damage}, stun ${s.blow.stun}`);
    if (p.rearms.length) console.log(`  re-arms the blow at: ${p.rearms.join(", ")}`);
  }
} else if (command === "object" && args.length >= 3) {
  const [type, anim] = [parseInt(args[0], 16), parseInt(args[1], 16)];
  const loads = args.slice(2).filter((a) => a.includes("@")).map((a) => {
    const [resource, vram] = a.split("@").map((n) => parseInt(n, 16));
    return { resource, vram };
  });
  const base = parseInt(args.find((a) => !a.includes("@") && args.indexOf(a) > 1) ?? "0", 16);
  const vram = objectVram(rom, loads);
  const palette = readPalette(rom, resourcePalette(rom, loads[0].resource));
  mkdirSync("preview", { recursive: true });
  for (let step = 0; step < 16; step++) {
    let pieces;
    try {
      pieces = readLayout(rom, objectFrame(rom, type, anim, step)).map((p) => ({ ...p, tile: p.tile + base }));
      if (pieces.length === 0) break;
    } catch {
      break;
    }
    const { image } = drawFrame(vram, pieces, palette);
    const out = `preview/rom-object-${hex(type)}-${hex(anim)}-${step}.png`;
    writeFileSync(out, encodePng(scaled(image, 3)));
    console.log(`wrote ${out} (${image.width}×${image.height}, ${pieces.length} pieces)`);
  }
} else if (command === "export") {
  const fighter = exportFighter(rom, GOKU);
  for (const note of fighter.notes) console.log(`  ${note}`);
  write("assets/sheets/goku.png", "data/entities/goku", fighter);
  for (const [variant, sheet] of Object.entries(fighter.variants ?? {})) {
    writeFileSync(`assets/sheets/goku@${variant}.png`, encodePng(sheet));
  }
  console.log(`goku: ${Object.keys(fighter.frames).length} frames, ${Object.keys(fighter.animations).length} animations`);
  for (const [name, spawn] of Object.entries(exportSpawns(rom, GOKU))) {
    write(`assets/sheets/spawns/${name}.png`, `data/spawns/${name}`, spawn);
    console.log(`${name}: ${Object.keys(spawn.frames).length} frames`);
  }
} else {
  console.error("usage: npm run rom -- tiles | frame <drawing> | frames | move <id> | moves | port <id> | export   (ids in hex)");
  process.exit(1);
}

/** Writes the sheet and the two sections the export owns; states stay hand-written. */
function write(sheetPath: string, dir: string, e: Exported): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(sheetPath, encodePng(e.sheet));
  writeFileSync(`${dir}/frames.json`, JSON.stringify(e.frames, null, 2) + "\n");
  writeFileSync(`${dir}/animations.json`, JSON.stringify(e.animations, null, 2) + "\n");
}

function describe(op: ScriptOp): string {
  switch (op.op) {
    case "show":
      return op.drawing === null
        ? `${op.frames} frames, keep the drawing`
        : `${op.frames} frames of ${hex(op.drawing)} (tile set ${hex(tileSetOf(rom, GOKU, op.drawing) ?? 0)})`;
    case "sound": return `sound ${hex(op.id)}`;
    case "effect": return `effect ${hex(op.id)} ?`;
    case "offset": return `draw ${op.dx}, ${op.dy} px from the position`;
    case "spawn": return `spawn object ${hex(op.type)}/${hex(op.anim)} at ${op.dx}, ${op.dy} (tiles +${hex(op.tiles)}, palette ${op.palette})`;
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
