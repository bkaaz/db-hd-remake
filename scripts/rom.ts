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
 *   npm run rom -- states --all      every generated fighter's states.json, written again
 *   npm run rom -- draft --fighter x a first specials.json, objects.json and spawn states from the reports
 *   npm run rom -- export --all      goku and every fighter that has states, exported again
 *   npm run rom -- commands          his command table into data/entities/<name>/commands.json
 *   npm run rom -- recorded --fighter x  his objects.json's palettes from logs/objects-x.*
 *                                    (--frames: its frames too, --dry-run)
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

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { paletteRecord } from "../src/rom/resource.ts";
import { FIRE, GOKU, SHOCK, ROM_PATH, scriptAt, tileResourceOf, type FighterTables } from "../src/rom/cartridge.ts";
import { fighterTables, ROSTER, type FighterName } from "../src/rom/roster.ts";
import { readScript, type ScriptOp } from "../src/rom/script.ts";
import { decompress } from "../src/rom/decompress.ts";
import { drawDrawing, exportFighter, exportSpawns, type Exported } from "../src/rom/export.ts";
import { encodePng, type Rgba } from "../src/sprites/png.ts";
import { describeFact } from "../src/rom/describe.ts";
import { arrow, buttonName, commandsFile, readCommands } from "../src/rom/commands.ts";
import { closeLines, NORMALS } from "../src/rom/buttons.ts";
import { fighterStates, generatedFighters, tablesOf } from "../src/rom/fighterStates.ts";
import { draftSpecials } from "../src/rom/draft.ts";
import { moveParts } from "../src/rom/parts.ts";
import { draftedObjects, draftObject, objectName, objectStates } from "../src/rom/draftObjects.ts";
import { MOVE_NAMES } from "../src/rom/moveNames.ts";
import { grabOf } from "../src/rom/grab.ts";
import { objectEntry, objectFacts } from "../src/rom/objectCode.ts";
import { fullestLife, readLives, readSnapshots } from "../src/rom/recording.ts";
import { findPalette, matchLoads } from "../src/rom/vramMatch.ts";
import { inRecording, OWN_OBJECTS, ownObjects, type OwnObject } from "../src/rom/ownObjects.ts";
import { correctObjects, paletteIdAt, recordedKinds } from "../src/rom/recordedObjects.ts";
import { lineName, spokenLines } from "../src/rom/lines.ts";
import { voiceSounds } from "../src/rom/voice.ts";
import { romIds, type Sounds } from "../src/audio/sounds.ts";
import { moveOf, todo } from "../src/rom/todo.ts";
import { handlerAt, sameHandler } from "../src/rom/handler.ts";
import { readAttributes } from "../src/rom/attributes.ts";
import { commandContext } from "../src/rom/conditions.ts";
import type { StatesFile } from "../src/entity/states.ts";
import { portReport } from "../src/rom/port.ts";
import { inTableOrder, missingEntries } from "../src/rom/entries.ts";
import { setsOver } from "../src/rom/recolour.ts";
import type { PalettesFile, Rgb } from "../src/entity/palettesFile.ts";
import { long } from "../src/rom/disasm.ts";
import { objectFrame } from "../src/rom/object.ts";
import { objectVram, resourcePalette, resourceStream } from "../src/rom/resource.ts";
import { drawFrame, readLayout, readPalette } from "../src/rom/frame.ts";
import { BG1, BG2, drawLayer, drawStage, loadStage, STAGE_COUNT } from "../src/rom/stage.ts";
import { bandsPicture } from "../src/rom/bands.ts";
import { BANDS } from "../src/arena/bands.ts";
import { altPalettes, ARENAS, exportArena, flashPalettes, glowPalettes, introPalettes, lightingPalettes, runPalettes, winPalettes } from "../src/rom/arena.ts";
import { drawHud, exportHud } from "../src/rom/hud.ts";

if (!existsSync(ROM_PATH)) {
  console.error(`no cartridge at ${ROM_PATH} — it is the owner's own dump (BYOA)`);
  process.exit(1);
}
const rom = new Uint8Array(readFileSync(ROM_PATH));

/** His colour sets of our own (`palettes.json`), over his own palette and the variants given — none without the file. */
/**
 * Another fighter's sheets besides his own: each lighting, his glow, player
 * two's colours and his winning pose's. Goku's own export takes no winning
 * colours: his 3e loads none ($20:80D6).
 */
function litOf(t: FighterTables): Record<string, number> {
  return { ...lightingPalettes(rom, t), ...glowPalettes(rom, t), ...flashPalettes(rom, t), ...altPalettes(rom, t), ...winPalettes(rom, t), ...runPalettes(rom, t) };
}

function colourSets(name: string, palette: number, variants: Record<string, number>): Record<string, Rgb[]> {
  const path = `data/entities/${name}/palettes.json`;
  return existsSync(path) ? setsOver(rom, palette, variants, JSON.parse(readFileSync(path, "utf8")) as PalettesFile) : {};
}
/** His `states.json` and `attributes.json`, written whole, and what became of the template on the way. */
function writeStates(name: string, t: FighterTables): void {
  const { file, made, own } = fighterStates(rom, name, t);
  writeFileSync(`data/entities/${name}/states.json`, JSON.stringify(file, null, 2) + "\n");
  if (own) console.log(`his own: ${Object.keys(own.states).join(", ")} (data/entities/${name}/specials.json)`);
  for (const [state, why] of Object.entries(made.dropped)) console.log(`dropped ${state}: ${why}`);
  for (const [state, what] of Object.entries(made.lost)) console.log(`${state} lost ${what.join(", ")}`);
  for (const [state, [was, is]] of Object.entries(made.moved)) console.log(`${state} fires from ${is} (goku's ${was})`);
  for (const [state, [was, is]] of Object.entries(made.reblown)) console.log(`${state}: ${was} -> ${is}`);
  // a copy is only goku's logic where it runs goku's code: the rest are his own, still to read
  // a move he plays a state of his own from is read, whichever of its parts the template's copy plays
  const read = new Set([...Object.values(own?.states ?? {}).map((d) => moveOf(d.anim)), ...(own?.read ?? []).map((m) => parseInt(m, 16))]);
  for (const [state, def] of Object.entries(made.file.states)) {
    if (own?.replaces?.includes(state)) continue;
    const move = moveOf(def.anim);
    if (move !== null && !read.has(move) && !sameHandler(rom, GOKU, t, move))
      console.log(`${state} copied, but his ${def.anim} runs his own handler (${long(handlerAt(rom, t.character, move))}) — to read`);
  }
  const his = readAttributes(rom, t.character);
  // his defence, gravity, grab range and close lines; Goku's for what is not read (push width); his lightings, and the fire
  const attributes = JSON.parse(readFileSync("data/entities/goku/attributes.json", "utf8"));
  writeFileSync(
    `data/entities/${name}/attributes.json`,
    JSON.stringify(
      {
        ...attributes,
        defence: his.defence,
        gravity: his.gravity,
        grabRange: commandContext(rom, t.character).grab,
        closeRange: { attack: closeLines(rom, t.character).y, smash: closeLines(rom, t.character).b },
        palettes: [...Object.keys(litOf(t)), ...Object.keys(introPalettes(rom, t)), ...Object.keys(colourSets(name, t.palette, litOf(t))), ...Object.keys(FIRE), ...Object.keys(SHOCK)],
        burn: Object.keys(FIRE),
        shock: Object.keys(SHOCK),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${name}: ${Object.keys(file.states).length} states; his defence, gravity, walk, dash, jump and close lines; Goku's push width`);
}

// `--fighter <name>` reads another fighter of the roster, and exports only him
const argv = process.argv.slice(2);
const named = argv.indexOf("--fighter");
const name = named >= 0 ? argv[named + 1] : "goku";
const T = named >= 0 ? tablesOf(rom, name) : GOKU;
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
  // each sound id with what of ours plays it — the shared bank and his own voices
  const banks = ["data/audio/sounds.json", `data/entities/${name}/sounds.json`].filter((f) => existsSync(f));
  const ours = romIds(...banks.map((f) => JSON.parse(readFileSync(f, "utf8")) as Sounds));
  const heard = (id: number) => `${hex(id)} (${ours.get(id) ?? "no bank entry"})`;
  console.log(`move ${hex(r.move)} — handler ${long(r.handler)}`);
  console.log(`input: ${r.inputs.join(" | ") || "none from a button or a command"}`);
  for (const c of r.commands) {
    console.log(`needs: ${c.needs.join("; ") || "nothing"}`);
    if (c.cost) console.log(`costs: ${c.cost} health`);
    if (c.opponentMove !== null) console.log(`puts the opponent in move ${hex(c.opponentMove)}`);
  }
  for (const f of r.anyFrame) console.log(`handler: ${describeFact(f)}`);
  for (const h of r.holds) console.log(`  held against ${h.against}: ${h.at.map(([dx, dy], i) => `${h.steps[i]}: (${dx}, ${dy})`).join(", ")} (step: offset)`);
  console.log("frames count from each part's start; sounds are the cartridge's ids, not clips");
  for (const p of r.parts) {
    const blow = p.blow ? `blow at ${p.blow.frame}: ${p.blow.type}, damage ${p.blow.damage}, stun ${p.blow.stun}` : "no blow";
    const speed = [`vel ${p.vel}`, ...p.velAt.map(([f, v]) => `${f}: ${v}`)].join(", ");
    console.log(`\n${p.anim}  (move frames ${p.from}–${p.from + p.frames - 1})`);
    console.log(`  ${blow}`);
    console.log(`  speed: ${speed}`);
    if (p.sounds.length)
      console.log(`  sounds: ${p.sounds.map((s) => `${s.frame}: ${heard(s.id)}${s.handler ? (s.opponent ? ", the handler's, the opponent's" : ", the handler's") : ""}`).join(", ")}`);
    for (const s of p.spawns) {
      console.log(`  spawns at ${s.frame} (counter ${hex(s.counter)}): object ${hex(s.type)}/${hex(s.anim)}, vx ${s.vx} vy ${s.vy} — its blow ${s.blow.type}, damage ${s.blow.damage}, stun ${s.blow.stun}`);
      // what the object's own code plays, which no script shows (Energy Field's 19)
      const own = [...new Set(objectFacts(rom, s.type, s.anim).flatMap((f) => (f.sound === undefined ? [] : [f.sound])))];
      if (own.length) console.log(`    its code plays: ${own.map(heard).join(", ")}`);
    }
    if (p.rearms.length) console.log(`  re-arms the blow at: ${p.rearms.join(", ")}`);
    for (const u of p.unhittable)
      console.log(`  ${u.frame}: ${u.on ? "blows pass him by" : "can be hit again"}${u.pass ? ", bodies pass (pushless)" : ""} (field 0x96)`);
    for (const f of p.onFrames) console.log(`  handler at ${f.frame}: ${f.what}`);
    for (const step of new Set(p.onSteps.map((f) => f.step)))
      console.log(`  handler on step ${step}: ${grouped(p.onSteps.filter((f) => f.step === step))}`);
  }
} else if (command === "grab" && args.length >= 1) {
  // a throw's `grab`, ready for its state: the reaction is the state that plays the move he is put in
  const r = portReport(rom, T, parseInt(args[0], 16));
  const states = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
  const move = r.launch ? `m${r.launch.move.toString(16).padStart(2, "0")}` : "";
  const reaction = Object.entries(states.states).find(([, def]) => def.anim === move)?.[0] ?? move;
  console.log(JSON.stringify(grabOf(r, reaction)));
} else if (command === "todo" && T !== GOKU) {
  // what is left to read for him, given goku is ported: moves on code goku's states already play are read
  const goku = { name: "goku", t: GOKU, states: JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile };
  // and his own states, his specials merged in: a move one of them plays is read too
  const ownPath = `data/entities/${name}/states.json`;
  const his = existsSync(ownPath) ? [{ name, t: T, states: JSON.parse(readFileSync(ownPath, "utf8")) as StatesFile }] : [];
  const left = todo(rom, T, [goku, ...his]);
  console.log(`read — the same handler as a move goku plays, or one of his own states (${left.read.length}):`);
  for (const r of left.read) console.log(`  ${hex(r.move)}  as ${r.by}'s ${r.states.join(", ")}`);
  console.log(`\nto read — handlers no ported move runs (${left.toRead.length}), the most shared first:`);
  const objects = new Map<string, string>();
  for (const r of left.toRead) {
    const report = portReport(rom, T, r.moves[0]);
    const blows = report.parts.filter((p) => p.blow).length;
    const spawns = r.moves.flatMap((m) => portReport(rom, T, m).parts.flatMap((p) => p.spawns.map((sp) => `${hex(sp.type)}/${hex(sp.anim)}`)));
    for (const o of spawns) objects.set(o, hex(r.moves[0]));
    const asked = r.moves.flatMap((m) => portReport(rom, T, m).inputs);
    const what = [asked.join(" | ") || "no button", blows ? `${blows} blow${blows > 1 ? "s" : ""}` : "", spawns.length ? `spawns ${[...new Set(spawns)].join(" ")}` : ""];
    const shared = r.fighters > 1 ? `, run by ${r.fighters} of the roster` : "";
    console.log(`  ${r.moves.map(hex).join(" ").padEnd(11)} ${long(r.handler)}${shared}  ${what.filter(Boolean).join(", ")}`);
  }
  console.log(`\n${left.elsewhere} more moves have a script nobody reaches by a button or plays yet`);
  const exported = new Set(
    [...GOKU.objects.spawns, ...(OWN_OBJECTS[name as FighterName] ?? [])].map((sp) => `${hex(sp.type)}/${hex(sp.anim)}`),
  );
  const [have, need] = [[...objects.keys()].filter((o) => exported.has(o)), [...objects.keys()].filter((o) => !exported.has(o))];
  console.log(`objects: already exported ${have.join(" ") || "none"}; to record ${need.join(" ") || "none"}`);
} else if (command === "spawns") {
  // what to record for this fighter's objects (ADR 0036): every move that puts one out, how to ask for it
  const commands = readCommands(rom, T.character);
  for (let move = 0; move < 0x100; move++) {
    let ops: ScriptOp[];
    try {
      ops = readScript(rom, scriptAt(rom, T, move));
    } catch {
      continue;
    }
    const spawns = ops.flatMap((op) => (op.op === "spawn" ? [op] : []));
    if (spawns.length === 0) continue;
    const asked = [
      ...(NORMALS[move] ? [NORMALS[move]] : []),
      ...commands.filter((c) => c.move === move).map((c) => `${c.where}: ${[...c.directions.map(arrow), buttonName(c.button)].join(" ")}`),
    ];
    const objects = spawns.map((s) => `${hex(s.type)}/${hex(s.anim)}${s.counter ? ` (counter ${hex(s.counter)})` : ""}`);
    console.log(`${hex(move)}  ${(asked.join(" | ") || "no button: a handler or another move starts it").padEnd(34)}  ${objects.join(", ")}`);
  }
} else if (command === "objects") {
  // a recording of the object slots read back (ADR 0036): each object's lives, the fullest first
  const lives = readLives(readFileSync(args[0] ?? "logs/objects-rec.txt", "utf8"));
  const kinds = [...new Set(lives.map((l) => `${hex(l.type)}/${hex(l.anim)}`))];
  for (const kind of kinds.sort()) {
    const all = lives.filter((l) => `${hex(l.type)}/${hex(l.anim)}` === kind);
    const full = fullestLife(all, all[0].type, all[0].anim)!;
    const becomes = [...new Set(all.flatMap((l) => (l.then ? [`${hex(l.then.type)}/${hex(l.then.anim)}${l.hit ? " on a hit" : ""}`] : [])))];
    console.log(`${kind}  ${all.length}× — longest ${full.to - full.from} frames, vx ${full.vx}, vy ${full.vy}${becomes.length ? `, becomes ${becomes.join(", ")}` : ""}`);
    console.log(`  frames: ${full.steps.map((s) => `${s.frame}×${s.dur}`).join(" ")}`);
  }
} else if (command === "recorded") {
  // his objects.json corrected from his recording: palettes, with --frames what it
  // shows too (recordedObjects.ts says why not by default); --dry-run says what would change
  const path = `data/entities/${name}/objects.json`;
  const objects: OwnObject[] = JSON.parse(readFileSync(path, "utf8"));
  const kinds = recordedKinds(
    readLives(readFileSync(`logs/objects-${name}.txt`, "utf8")),
    readSnapshots(new Uint8Array(readFileSync(`logs/objects-${name}.bin`))),
    (colours) => {
      const at = findPalette(rom, new Uint8Array(colours))[0];
      return at === undefined ? null : paletteIdAt(rom, at);
    },
  );
  const corrected = correctObjects(objects, kinds, { frames: args.includes("--frames") });
  // an object is reported only for what its file does not already say
  const changes = corrected.objects.flatMap((after, i) => {
    const before = objects[i];
    const said = [
      ...(after.palette !== before.palette ? [`palette ${hex(before.palette)} → ${hex(after.palette)}`] : []),
      ...(before.animations && !after.animations ? ["frames as recorded"] : []),
    ];
    return said.length > 0 ? [`${after.name}: ${said.join(", ")}`] : [];
  });
  const stale = corrected.asRecorded.filter((spawn) => existsSync(`data/spawns/${spawn}/animations.json`) && objects.find((o) => o.name === spawn)?.animations);
  for (const line of changes) console.log(line);
  if (changes.length === 0) console.log(`${path}: as recorded already`);
  if (!args.includes("--dry-run") && changes.length > 0) {
    writeFileSync(path, JSON.stringify(corrected.objects, null, 2) + "\n");
    for (const spawn of stale) rmSync(`data/spawns/${spawn}/animations.json`);
    console.log(`now: npm run rom -- export --fighter ${name}`);
  }
} else if (command === "vram") {
  // each object's tiles and colours in a recording's snapshots, named in the
  // cartridge: which resources lie in OBJ VRAM, and where its palette is
  const bin = new Uint8Array(readFileSync(args[0] ?? "logs/objects-rec.bin"));
  const seen = new Set<string>();
  for (const snap of readSnapshots(bin)) {
    const kind = `${hex(snap.bytes[0] & 0x7f)}/${hex(snap.bytes[1])}`;
    if (seen.has(kind)) continue;
    seen.add(kind);
    const obj = snap.vram.subarray(0xc000);
    const loads = matchLoads(rom, obj, [...Array(0x200).keys()]);
    const palette = (snap.bytes[4] >> 1) & 7;
    const colours = snap.cgram.subarray(0x100 + 32 * palette, 0x120 + 32 * palette);
    const at = findPalette(rom, new Uint8Array(colours));
    console.log(`${kind}  f${snap.frame}  tile base ${hex(snap.bytes[3])}  OBJ palette ${palette}: ${at.map((a) => "0x" + a.toString(16)).join(" ") || "in no ROM record"}`);
    console.log(`  in VRAM: ${loads.map((l) => `${hex(l.resource)}@${l.vram.toString(16)}`).join(" ")}`);
  }
} else if (command === "code" && args.length >= 2) {
  // an object's code read: how long it lives, how it steps, what it waits on
  const [type, anim] = [parseInt(args[0], 16), parseInt(args[1], 16)];
  console.log(`object ${hex(type)}/${hex(anim)} — code from ${long(objectEntry(rom, type))}; frames are its timer`);
  for (const f of objectFacts(rom, type, anim)) console.log(`  ${describeFact(f)}`);
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
} else if (command === "commands") {
  // the sequences as the engine matches them (src/input/command.ts, ADR 0050)
  const file = commandsFile(rom, T.character);
  writeFileSync(`data/entities/${name}/commands.json`, JSON.stringify(file, null, 2) + "\n");
  console.log(`${name}: ${file.commands.length} commands into data/entities/${name}/commands.json`);
} else if (command === "entries") {
  // states whose move's handler reads commands ($0F:9EB1) but lack an entry for some
  const states = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
  // --order: put every state's command entries in the cartridge's order (goku's are by hand)
  if (args.includes("--order")) {
    writeFileSync(`data/entities/${name}/states.json`, JSON.stringify(inTableOrder(states, readCommands(rom, T.character)), null, 2) + "\n");
    console.log(`${name}: command entries put in the table's order, its last row first`);
  }
  const missing = missingEntries(rom, T, states);
  for (const m of missing) console.log(`${m.state.padEnd(20)} ${states.states[m.state].anim?.padEnd(7)} ${(m.when || "always").padEnd(24)} ${m.moves.map(hex).join(" ")}`);
  if (missing.length === 0) console.log(`${name}: every state that reads commands has an entry for each`);
} else if (command === "roster") {
  ROSTER.forEach((name, c) => {
    const t = fighterTables(rom, c);
    const page = tileResourceOf(rom, t, 0) ?? 0;
    console.log(`${c} ${name.padEnd(8)} ${t.drawings} drawings, resources ${hex(page >> 8)}xx, palette 0x${t.palette.toString(16)}, boxes 0x${t.boxes.toString(16)}`);
  });
} else if (command === "draft" && T !== GOKU) {
  // a first specials.json from the reports; a second run needs --force, the file being by hand from then on
  const path = `data/entities/${name}/specials.json`;
  if (existsSync(path) && !args.includes("--force")) throw new Error(`${path} is there: --force to write it again`);
  const types = JSON.parse(readFileSync("data/hit-types.json", "utf8")) as Record<string, unknown>;
  const known = (type: string) => type in types;
  const shared = (type: number, anim: number) => GOKU.objects.spawns.find((sp) => sp.type === type && sp.anim === anim)?.name;
  const spawnOf = (type: number, anim: number) => shared(type, anim) ?? objectName(name, { type, anim });
  // a normal on code of his own, or cut in two by what it puts out, cannot be goku's state on his animation
  const template = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
  const normals = Object.fromEntries(
    Object.entries(template.states).flatMap(([state, def]) => {
      const move = /^m(9[0-9a])$/.exec(def.anim ?? "")?.[1];
      if (!move) return [];
      const id = parseInt(move, 16);
      const whole = moveParts(rom, T, id).parts.length === 1 && sameHandler(rom, GOKU, T, id);
      return whole ? [] : [[move, state]];
    }),
  );
  const jumping = Object.keys(normals).filter((m) => template.states[normals[m]].airborne);
  const draft = draftSpecials(rom, T, MOVE_NAMES[name as FighterName] ?? {}, spawnOf, known, normals, jumping);
  const objects = draft.objects.flatMap(({ move, spawn }) => {
    if (shared(spawn.type, spawn.anim)) return [];
    const object = draftObject(rom, T, name, move, spawn);
    if (object) {
      mkdirSync(`data/spawns/${object.name}`, { recursive: true });
      writeFileSync(`data/spawns/${object.name}/states.json`, JSON.stringify(objectStates(rom, spawn, known), null, 2) + "\n");
      // a body's gravity is not an object's: b0's speed holds the whole flight
      if (spawn.vy !== 0) writeFileSync(`data/spawns/${object.name}/attributes.json`, JSON.stringify({ gravity: 0 }, null, 2) + "\n");
    } else console.log(`no frames for object ${hex(spawn.type)}/${hex(spawn.anim)}`);
    return object ? [object] : [];
  });
  const unique = [...new Map(objects.map((o) => [o.name, o])).values()];
  // what has no picture to show is fired by nobody: gone with no trace of a state naming it
  const exists = (spawn: string) => !spawn.startsWith(`${name}_`) || unique.some((o) => o.name === spawn);
  for (const def of Object.values(draft.specials.states)) {
    if (!def.fires) continue;
    const all = [{ spawn: def.fires.spawn, at: def.fires.at }, ...(def.fires.with ?? [])].filter((f) => exists(f.spawn));
    if (all.length === 0) delete def.fires;
    else {
      const [first, ...rest] = all;
      def.fires = { ...def.fires, ...first, ...(rest.length > 0 ? { with: rest } : { with: undefined }) };
    }
  }
  writeFileSync(`data/entities/${name}/objects.json`, JSON.stringify(unique, null, 2) + "\n");
  writeFileSync(path, JSON.stringify(draft.specials, null, 2) + "\n");
  for (const m of draft.moves) console.log(`| \`${m.move}\` ${m.state} | ${m.input} | ${m.left.join("; ") || "—"} |`);
  console.log(`${unique.length} objects with no recording`);
} else if (command === "export" && args.includes("--all")) {
  // each in a run of its own: the tables and the objects are this run's, one fighter's
  for (const fighter of ["goku", ...generatedFighters()]) {
    const who = fighter === "goku" ? [] : ["--fighter", fighter];
    execFileSync(process.execPath, [...process.execArgv, process.argv[1], "export", ...who], { stdio: "inherit" });
  }
} else if (command === "states" && args.includes("--all")) {
  for (const fighter of generatedFighters()) writeStates(fighter, tablesOf(rom, fighter));
} else if (command === "states" && T !== GOKU) {
  writeStates(name, T);
} else if (command === "export" && T !== GOKU) {
  // his lightings and the fire; the shared spawns, the arenas and the HUD stay Goku's export
  const lit = litOf(T);
  const fighter = exportFighter(rom, { ...T, variants: { ...FIRE, ...shockPalettes(rom), ...lit, ...introPalettes(rom, T), ...colourSets(name, T.palette, lit) } });
  for (const note of fighter.notes) console.log(`  ${note}`);
  write(`assets/sheets/${name}.png`, `data/entities/${name}`, fighter);
  for (const [variant, sheet] of Object.entries(fighter.variants ?? {})) {
    writeFileSync(`assets/sheets/${name}@${variant}.png`, encodePng(sheet));
  }
  console.log(`${name}: ${Object.keys(fighter.frames).length} frames, ${Object.keys(fighter.animations).length} animations`);
  // his own objects: tiles and palette from code, timing from his recording (ADR 0036)
  const own = [...(OWN_OBJECTS[name as FighterName] ?? []), ...draftedObjects(name)];
  if (own.length > 0) {
    // his own: the script writes objects-rec.txt, kept as objects-<name>.txt
    // once it is his, so recording the next fighter leaves this one's alone
    const recording = `logs/objects-${name}.txt`;
    const needed = own.some((o) => !o.ticks && !o.animations);
    if (needed && !existsSync(recording)) throw new Error(`${recording} is missing: record his objects (tools/re/record-objects.lua) and keep logs/objects-rec.txt as it`);
    const lives = existsSync(recording) ? readLives(readFileSync(recording, "utf8")) : [];
    // one exported before is kept: a later recording may show it for less
    // time, and the frames it misses would be dropped (Final Flash, 2026-11-02)
    const kept = own.filter((o) => existsSync(`data/spawns/${o.name}/animations.json`));
    for (const o of kept) console.log(`${o.name}: kept as exported before — delete data/spawns/${o.name} to export it again`);
    const { recorded, missed } = inRecording(own.filter((o) => !kept.includes(o)), lives);
    if (missed.length > 0) throw new Error(`not in ${recording}: ${missed.map((o) => o.name).join(", ")}`);
    const spawns = ownObjects(rom, T, recorded, lives);
    for (const [spawn, e] of Object.entries(exportSpawns(rom, { ...T, objects: { loads: [], palettes: {}, spawns } }))) {
      writeSpawn(spawn, e);
      const def = recorded.find((o) => o.name === spawn);
      const timed = def?.ticks || def?.animations ? "timed by its code" : `shown as ${recording} shows them`;
      console.log(`${spawn}: ${Object.keys(e.frames).length} frames, ${timed}`);
    }
  }
  writeVoice(T, name);
} else if (command === "export") {
  // the fire's palettes and each arena lighting's, drawn as sheets of their own (ADR 0026)
  const lit = { ...lightingPalettes(rom, GOKU), ...glowPalettes(rom, GOKU), ...altPalettes(rom, GOKU) };
  const fighter = exportFighter(rom, { ...GOKU, variants: { ...GOKU.variants, ...shockPalettes(rom), ...lit, ...colourSets("goku", GOKU.palette, lit) } });
  for (const note of fighter.notes) console.log(`  ${note}`);
  write("assets/sheets/goku.png", "data/entities/goku", fighter);
  for (const [variant, sheet] of Object.entries(fighter.variants ?? {})) {
    writeFileSync(`assets/sheets/goku@${variant}.png`, encodePng(sheet));
  }
  console.log(`goku: ${Object.keys(fighter.frames).length} frames, ${Object.keys(fighter.animations).length} animations`);
  writeVoice(GOKU, "goku");
  for (const [name, spawn] of Object.entries(exportSpawns(rom, GOKU))) {
    writeSpawn(name, spawn);
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
  // the journey's bands, every screen of them: a backdrop of no arena (src/arena/bands.ts)
  mkdirSync(`assets/arenas/${BANDS.arena}`, { recursive: true });
  writeFileSync(`assets/arenas/${BANDS.arena}/${BANDS.layer}@${BANDS.time}.png`, encodePng(bandsPicture(rom)));
  console.log("journey: its bands");
  // every fighter's name, by his place in the roster ($00:C511)
  const hud = exportHud(rom, Object.fromEntries(ROSTER.map((fighter, character) => [fighter, character])));
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
/** The shock's two palette records, at their addresses: the same for every fighter. */
function shockPalettes(rom: Uint8Array): Record<string, number> {
  return Object.fromEntries(Object.entries(SHOCK).map(([name, record]) => [name, paletteRecord(rom, record).at]));
}

/** A fighter's voice and lines, on the sound test's files (`npm run sound-test`); his other sounds kept. */
function writeVoice(t: FighterTables, fighter: string): void {
  const ids = spokenLines(rom, t);
  const path = `data/entities/${fighter}/sounds.json`;
  const sounds = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Sounds) : {};
  writeFileSync(path, JSON.stringify(voiceSounds(sounds, fighter, ids), null, 2) + "\n");
  console.log(`${fighter}: voice 30 31 32, lines ${ids.map(lineName).join(" ")}; ${path}`);
}

function write(sheetPath: string, dir: string, e: Exported): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(sheetPath, encodePng(e.sheet));
  writeFileSync(`${dir}/frames.json`, JSON.stringify(e.frames, null, 2) + "\n");
  writeFileSync(`${dir}/animations.json`, JSON.stringify(e.animations, null, 2) + "\n");
}

/**
 * A spawn as `write` leaves it, and the palettes its code steps through: a
 * sheet each beside its own, named in its `attributes.json` (`shimmer`).
 */
function writeSpawn(spawn: string, e: Exported): void {
  write(`assets/sheets/spawns/${spawn}.png`, `data/spawns/${spawn}`, e);
  const variants = Object.entries(e.variants ?? {});
  for (const [variant, sheet] of variants) writeFileSync(`assets/sheets/spawns/${spawn}@${variant}.png`, encodePng(sheet));
  const names = variants.map(([variant]) => variant);
  if (!names.length) return;
  // beside what is there by hand (Big Bang's gravity 0)
  const at = `data/spawns/${spawn}/attributes.json`;
  const kept = existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : {};
  const shimmer = names.filter((n) => n.startsWith("shimmer"));
  writeFileSync(at, JSON.stringify({ ...kept, palettes: names, ...(shimmer.length && { shimmer }) }, null, 2) + "\n");
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
    case "spawn": return `spawn object ${hex(op.type)}/${hex(op.anim)} at ${op.dx}, ${op.dy}, vx ${op.vx} vy ${op.vy}, timer ${op.timer} (tiles +${hex(op.tiles)}, palette ${op.palette}) when the counter is ${hex(op.counter)}`;
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
function grouped(facts: { under: string; what: string }[]): string {
  const groups: { under: string; what: string[] }[] = [];
  for (const { under, what } of facts) {
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
