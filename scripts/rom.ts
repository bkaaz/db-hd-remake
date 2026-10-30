/**
 * Read Goku out of the owner's cartridge (ADR 0016).
 *
 *   npm run rom -- tiles             every resource goku's drawings use: where, whether it unpacks
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
 *   npm run rom -- stage [id …]      a stage's two background layers, flat, into
 *                                    preview/ — every stage when no id is given
 *   npm run rom -- roster            every fighter: drawings, resources, palette, boxes
 *   … --fighter vegetto              any reading command above, for another fighter
 *   npm run rom -- export            every drawing into assets/sheets/goku.png and
 *                                    data/entities/goku/frames.json (frame n = drawing n),
 *                                    every move into its animations.json as m00…mff;
 *                                    each arena into assets/arenas/ and data/arenas/,
 *                                    the HUD into assets/hud/ and data/hud/
 *
 * Ids are hex, as the fighter's RAM holds them: the drawing is field 0x0a
 * (src/rom/cartridge.ts), and its tile set comes from the cartridge's table.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GOKU, ROM_PATH, scriptAt, tileResourceOf } from "../src/rom/cartridge.ts";
import { fighterNamed, fighterTables, ROSTER } from "../src/rom/roster.ts";
import { readScript, type ScriptOp } from "../src/rom/script.ts";
import { decompress } from "../src/rom/decompress.ts";
import { drawDrawing, exportFighter, exportSpawns, type Exported } from "../src/rom/export.ts";
import { encodePng, type Rgba } from "../src/sprites/png.ts";
import { describeFact, portReport } from "../src/rom/port.ts";
import { long } from "../src/rom/disasm.ts";
import { objectFrame } from "../src/rom/object.ts";
import { objectVram, resourcePalette, resourceStream } from "../src/rom/resource.ts";
import { drawFrame, readLayout, readPalette } from "../src/rom/frame.ts";
import { BG1, BG2, drawLayer, drawStage, loadStage, STAGE_COUNT } from "../src/rom/stage.ts";
import { ARENAS, exportArena, lightingPalettes } from "../src/rom/arena.ts";
import { drawHud, exportHud } from "../src/rom/hud.ts";

if (!existsSync(ROM_PATH)) {
  console.error(`no cartridge at ${ROM_PATH} — it is the owner's own dump (BYOA)`);
  process.exit(1);
}
const rom = new Uint8Array(readFileSync(ROM_PATH));
// `--fighter <name>` reads another fighter of the roster; the export stays Goku's
const argv = process.argv.slice(2);
const named = argv.indexOf("--fighter");
const T = named >= 0 ? fighterNamed(rom, argv[named + 1]) : GOKU;
if (named >= 0) argv.splice(named, 2);
const [command, ...args] = argv;

if (command === "tiles") {
  let ok = 0;
  let bad = 0;
  // every resource a drawing of the fighter's is cut from, once
  const resources = new Set<number>();
  for (let d = 0; d < T.drawings; d++) {
    const r = tileResourceOf(rom, T, d);
    if (r !== null) resources.add(r);
  }
  for (const i of [...resources].sort((a, b) => a - b)) {
    const at = resourceStream(rom, i);
    if (at === null) {
      console.log(`${hex(i)}  an unused slot`);
      continue;
    }
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
  const { image } = drawDrawing(rom, T, drawing);
  mkdirSync("preview", { recursive: true });
  const out = `preview/rom-${ROSTER[T.character]}-${hex(drawing)}.png`;
  writeFileSync(out, encodePng(scaled(image, scale)));
  console.log(`wrote ${out} (${image.width}×${image.height}, shown ×${scale})`);
} else if (command === "frames") {
  let ok = 0;
  for (let d = 0; d < T.drawings; d++) {
    if (tileResourceOf(rom, T, d) === null) continue;
    try {
      drawDrawing(rom, T, d);
      ok++;
    } catch (e) {
      console.log(`${hex(d)}  FAILED: ${(e as Error).message}`);
    }
  }
  console.log(`${ok} drawings of ${T.drawings} ids drawn`);
} else if (command === "move" && args.length >= 1) {
  const move = parseInt(args[0], 16);
  const at = scriptAt(rom, T, move);
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
      const ops = readScript(rom, scriptAt(rom, T, move));
      const frames = ops.reduce((n, op) => n + (op.op === "show" ? op.frames : 0), 0);
      const drawings = ops.flatMap((op) => (op.op === "show" && op.drawing !== null ? [hex(op.drawing)] : []));
      console.log(`${hex(move)}  ${String(frames).padStart(3)} frames  ${drawings.join(" ")}`);
    } catch (e) {
      console.log(`${hex(move)}  -- ${(e as Error).message}`);
    }
  }
} else if (command === "port" && args.length >= 1) {
  const r = portReport(rom, T, parseInt(args[0], 16));
  console.log(`move ${hex(r.move)} — handler ${long(r.handler)}`);
  console.log(`input: ${r.inputs.join(" | ") || "none from a button or a command"}`);
  for (const c of r.commands) {
    console.log(`needs: ${c.needs.join("; ") || "nothing"}`);
    if (c.cost) console.log(`costs: ${c.cost} health`);
    if (c.opponentMove !== null) console.log(`puts the opponent in move ${hex(c.opponentMove)}`);
  }
  for (const f of r.anyFrame) console.log(`handler: ${describeFact(f)}`);
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
      console.log(`  spawns at ${s.frame} (counter ${hex(s.counter)}): object ${hex(s.type)}/${hex(s.anim)} — its blow ${s.blow.type}, damage ${s.blow.damage}, stun ${s.blow.stun}`);
    if (p.rearms.length) console.log(`  re-arms the blow at: ${p.rearms.join(", ")}`);
    for (const f of p.onFrames) console.log(`  handler at ${f.frame}: ${f.what}`);
    for (const step of new Set(p.onSteps.map((f) => f.step)))
      console.log(`  handler on step ${step}: ${grouped(p.onSteps.filter((f) => f.step === step).map((f) => f.what))}`);
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
} else if (command === "stage") {
  const ids = args.length ? args.map((a) => parseInt(a, 16)) : [...Array(STAGE_COUNT).keys()];
  mkdirSync("preview", { recursive: true });
  const rows: Rgba[][] = [];
  for (const id of ids) {
    const stage = loadStage(rom, id);
    const { mode, wide, arena } = stage.record;
    const [bg1, bg2] = [drawLayer(stage, BG1), drawLayer(stage, BG2)];
    const both = drawStage(stage);
    const out = `preview/rom-stage-${hex(id)}.png`;
    writeFileSync(out, encodePng(scaled(both, 2)));
    writeFileSync(`preview/rom-stage-${hex(id)}-bg1.png`, encodePng(scaled(bg1, 2)));
    writeFileSync(`preview/rom-stage-${hex(id)}-bg2.png`, encodePng(scaled(bg2, 2)));
    console.log(`wrote ${out} (arena ${arena}, mode ${mode}, ${wide ? 64 : 32} tiles wide)`);
    (rows[arena] ??= []).push(both);
  }
  if (args.length === 0) {
    writeFileSync("preview/rom-stages.png", encodePng(grid(rows.filter(Boolean))));
    console.log("wrote preview/rom-stages.png (a row per arena, its lightings across)");
  }
} else if (command === "hud") {
  mkdirSync("preview", { recursive: true });
  writeFileSync("preview/rom-hud.png", encodePng(scaled(drawHud(rom), 3)));
  console.log("wrote preview/rom-hud.png");
} else if (command === "roster") {
  ROSTER.forEach((name, c) => {
    const t = fighterTables(rom, c);
    const page = tileResourceOf(rom, t, 0) ?? 0;
    console.log(`${c} ${name.padEnd(8)} ${t.drawings} drawings, resources ${hex(page >> 8)}xx, palette 0x${t.palette.toString(16)}, boxes 0x${t.boxes.toString(16)}`);
  });
} else if (command === "export") {
  // the fire's palettes and each arena lighting's, drawn as sheets of their own (ADR 0026)
  const fighter = exportFighter(rom, { ...GOKU, variants: { ...GOKU.variants, ...lightingPalettes(rom, GOKU) } });
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
  for (const [name, source] of Object.entries(ARENAS)) {
    const { file, images } = exportArena(rom, source);
    mkdirSync(`assets/arenas/${name}`, { recursive: true });
    mkdirSync(`data/arenas/${name}`, { recursive: true });
    for (const [image, rgba] of Object.entries(images)) writeFileSync(`assets/arenas/${name}/${image}.png`, encodePng(rgba));
    writeFileSync(`data/arenas/${name}/arena.json`, JSON.stringify(file, null, 2) + "\n");
    console.log(`${name}: ${file.layers.length} layers × ${file.times.length} lightings`);
  }
  const hud = exportHud(rom, { goku: GOKU.character });
  mkdirSync("assets/hud", { recursive: true });
  mkdirSync("data/hud", { recursive: true });
  writeFileSync("assets/hud/hud.png", encodePng(hud.image));
  writeFileSync("data/hud/hud.json", JSON.stringify(hud.file, null, 2) + "\n");
  console.log(`hud: names for ${Object.keys(hud.file.names).join(", ")}`);
} else {
  console.error("usage: npm run rom -- tiles | frame <drawing> | frames | move <id> | moves | port <id> | stage [id …] | export   (ids in hex)");
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
    case "show": {
      const shown = op.drawing === null
        ? `${op.frames} frames, keep the drawing`
        : `${op.frames} frames of ${hex(op.drawing)} (resource ${hex(tileResourceOf(rom, T, op.drawing) ?? 0)})`;
      const opponent = op.opponent?.map((d, c) => `${ROSTER[c]} ${d === null ? "keeps" : hex(d)}`).join(", ");
      return opponent ? `${shown}; the opponent shows ${opponent}` : shown;
    }
    case "sound": return `sound ${hex(op.id)}`;
    case "voice": return `spoken line ${hex(op.id)}`;
    case "offset": return `draw ${op.dx}, ${op.dy} px from the position`;
    case "spawn": return `spawn object ${hex(op.type)}/${hex(op.anim)} at ${op.dx}, ${op.dy} (tiles +${hex(op.tiles)}, palette ${op.palette}) when the counter is ${hex(op.counter)}`;
    case "effect": return `draw effect kind ${op.kind} at ${op.dx}, ${op.dy}, size ${op.size}, param ${hex(op.param)} when the counter is ${hex(op.counter)}`;
    case "field96": return `field 0x96 = ${hex(op.value)}`;
    case "stop": return "stop here until the move's code moves on";
    case "opponent": return "the opponent's track: each step after shows him a drawing of his own, by his character";
    case "flip": return `flip ${op.h ? "h" : ""}${op.v ? "v" : ""}${op.h || op.v ? "" : "off"}`;
    case "hold": return `hold ${hex(op.drawing)} until released ?`;
    case "raw": return op.bytes.map(hex).join(" ") + "  (not read yet)";
  }
}

/** Facts in a row, the condition they share said once: "once it has landed: raises dust, bounces; …". */
function grouped(facts: string[]): string {
  const groups: { under: string; what: string[] }[] = [];
  for (const fact of facts) {
    const i = fact.indexOf(": ");
    const [under, what] = i < 0 ? ["", fact] : [fact.slice(0, i), fact.slice(i + 2)];
    if (groups.at(-1)?.under === under) groups.at(-1)!.what.push(what);
    else groups.push({ under, what: [what] });
  }
  return groups.map((g) => (g.under ? `${g.under}: ` : "") + g.what.join(", ")).join("; ");
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

/** Images in rows, each cell as big as the biggest, over the grey ground. */
function grid(rows: Rgba[][]): Rgba {
  const cellW = Math.max(...rows.flat().map((i) => i.width));
  const cellH = Math.max(...rows.flat().map((i) => i.height));
  const width = cellW * Math.max(...rows.map((r) => r.length));
  const height = cellH * rows.length;
  const data = new Uint8Array(width * height * 4);
  rows.forEach((row, ry) =>
    row.forEach((img, rx) => {
      const flat = scaled(img, 1);
      for (let y = 0; y < img.height; y++) {
        const at = ((ry * cellH + y) * width + rx * cellW) * 4;
        data.set(flat.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), at);
      }
    }),
  );
  return { width, height, data };
}
