/**
 * Build an animation from a list of frames, with boxes and timing derived from
 * the sprites (see src/sprites/boxes.ts).
 *
 * The point is that nothing here needs a human — or a language model — to read
 * a 2000-line frames.json and do arithmetic. You say which frames, in order;
 * this writes the animation and prints a short summary of what it did and how
 * confident each part is. The result is a **skeleton**: correct where it can be
 * computed (hurt boxes), a placeholder where it cannot (hit box, timing), meant
 * to be adjusted in the editor.
 *
 *   npm run anim -- goku punch --frames 42,43,44 --kind attack
 *   npm run anim -- goku walk  --frames 9,10 --kind loop --dur 12
 *   npm run anim -- goku --list
 *   npm run anim -- goku punch --frames 42,43 --kind attack --dry-run
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  activeIndex,
  durations,
  hitBox,
  hurtBox,
  hurtBoxesFromMask,
  type AnimKind,
  type DerivedBox,
  type FrameRect,
} from "../src/sprites/boxes.ts";
import { validateStates, type StatesFile } from "../src/entity/states.ts";
import { alphaMask, decodePng, type Rgba } from "../src/sprites/png.ts";

interface Step {
  frame: string;
  dur: number;
  boxes?: DerivedBox[];
}
interface Anim {
  loop: boolean;
  steps: Step[];
}

const KINDS: AnimKind[] = ["loop", "attack", "hurt"];

function die(message: string): never {
  console.error(`anim: ${message}`);
  process.exit(1);
}

interface Options {
  entity: string;
  anim?: string;
  frames: string[];
  kind: AnimKind;
  dur?: number;
  /** Explicit duration per step, when the phases differ in length. */
  durs?: number[];
  inset: number;
  /** How many hurt boxes to fit to the silhouette per frame (1 = bounding box). */
  hurtBoxes: number;
  loop?: boolean;
  hit: boolean;
  /** Recompute durations even when the frame list is unchanged. */
  retime: boolean;
  dryRun: boolean;
  list: boolean;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const opts: Options = {
    entity: "",
    frames: [],
    kind: "loop",
    inset: 0,
    hurtBoxes: 3,
    hit: true,
    retime: false,
    dryRun: false,
    list: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => argv[++i] ?? die(`${arg} needs a value`);
    switch (arg) {
      case "--frames":
        opts.frames = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--kind": {
        const k = next() as AnimKind;
        if (!KINDS.includes(k)) die(`--kind must be one of: ${KINDS.join(", ")}`);
        opts.kind = k;
        break;
      }
      case "--dur":
        opts.dur = Number(next());
        break;
      case "--durs":
        opts.durs = next().split(",").map((n) => Math.max(1, Number(n.trim())));
        break;
      case "--inset":
        opts.inset = Number(next());
        break;
      case "--hurt-boxes":
        opts.hurtBoxes = Math.max(1, Number(next()));
        break;
      case "--loop":
        opts.loop = true;
        break;
      case "--no-loop":
        opts.loop = false;
        break;
      case "--no-hit":
        opts.hit = false;
        break;
      case "--retime":
        opts.retime = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--list":
        opts.list = true;
        break;
      default:
        if (arg.startsWith("--")) die(`unknown option ${arg}`);
        positional.push(arg);
    }
  }

  opts.entity = positional[0] ?? die("usage: anim <entity> <animation> --frames 1,2,3 [--kind ...]");
  opts.anim = positional[1];
  return opts;
}

const readJson = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
};

/** Frame ids are plain numbers; check the frame exists before using it. */
function resolveFrameId(token: string, frames: Record<string, FrameRect>): string {
  if (frames[token]) return token;
  return die(`no frame "${token}" in frames.json`);
}

const fmtBox = (b: DerivedBox | null | undefined): string =>
  b ? `${b.x},${b.y} ${b.w}x${b.h}` : "—";

const fmtBoxes = (bs: DerivedBox[]): string => (bs.length ? bs.map(fmtBox).join(" | ") : "—");

/**
 * Hurt boxes for one frame. With the atlas available they are fitted to the
 * sprite's actual silhouette in horizontal bands; without it, all we know is
 * the frame's bounding box — one coarse rectangle.
 */
function hurtFor(atlas: Rgba | null, frame: FrameRect, count: number, inset: number): DerivedBox[] {
  if (atlas) {
    const boxes = hurtBoxesFromMask(alphaMask(atlas, frame), frame, count, inset);
    if (boxes.length > 0) return boxes;
  }
  const box = hurtBox(frame, inset);
  return box ? [box] : [];
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const dir = path.join(process.cwd(), "data", "entities", opts.entity);
  const framesFile = path.join(dir, "frames.json");
  const animsFile = path.join(dir, "animations.json");

  const frames = await readJson<Record<string, FrameRect>>(framesFile, {});
  if (Object.keys(frames).length === 0) die(`no frames in ${framesFile}`);
  const animations = await readJson<Record<string, Anim>>(animsFile, {});

  if (opts.list) {
    console.log(`${opts.entity}: ${Object.keys(frames).length} frames`);
    for (const [name, a] of Object.entries(animations)) {
      const total = a.steps.reduce((n, s) => n + s.dur, 0);
      const boxed = a.steps.filter((s) => s.boxes?.some((b) => b.type === "hurt")).length;
      const hits = a.steps.filter((s) => s.boxes?.some((b) => b.type === "hit")).length;
      console.log(
        `  ${name.padEnd(12)} ${a.loop ? "loop " : "once "} ${String(a.steps.length).padStart(2)} steps` +
          `  ${String(total).padStart(3)}f  hurt ${boxed}/${a.steps.length}` +
          (hits ? `  hit ${hits}` : ""),
      );
    }

    // Same validation the game and the editor run, so the state of the data can
    // be inspected without opening either.
    const states = await readJson<StatesFile | null>(path.join(dir, "states.json"), null);
    if (states) {
      const { errors, warnings } = validateStates(states, animations);
      console.log(`  states: ${Object.keys(states.states ?? {}).length}`);
      for (const e of errors) console.log(`  ERROR   ${e}`);
      for (const w of warnings) console.log(`  warning ${w}`);
      if (errors.length === 0 && warnings.length === 0) console.log("  states: no problems");
    }
    return;
  }

  const name = opts.anim ?? die("animation name required");
  if (opts.frames.length === 0) die("--frames is required (in playback order)");

  const listed = opts.frames.map((t) => resolveFrameId(t, frames));
  const activeInListed = activeIndex(listed.map((id) => frames[id]));

  // An attack comes back the way it went: it holds its striking pose, then
  // steps out through the frame immediately before it rather than cutting to
  // idle. That recovery frame is a repeat, so it is appended here instead of
  // being asked of the owner every time — the whole roster is drawn this way.
  const addRecovery =
    opts.kind === "attack" && activeInListed === listed.length - 1 && listed.length > 1;
  const ids = addRecovery ? [...listed, listed[activeInListed - 1]] : listed;
  const rects = ids.map((id) => frames[id]);
  const active = activeInListed;

  // Timing is tuned by hand in the editor, and rebuilding an animation to
  // recompute its boxes must not throw that away. If the frame list is the same
  // as what is on disk, the existing durations are kept; if it changed, the
  // steps no longer line up, so defaults come back — loudly, with the old
  // values printed so nothing disappears in silence.
  const existing = animations[name];
  const sameFrames =
    existing !== undefined &&
    existing.steps.length === ids.length &&
    existing.steps.every((s, i) => s.frame === ids[i]);
  const keepTiming =
    sameFrames && !opts.retime && opts.dur === undefined && opts.durs === undefined;
  if (opts.durs && opts.durs.length !== ids.length) {
    die(`--durs has ${opts.durs.length} values but there are ${ids.length} frames`);
  }
  const durs = keepTiming
    ? existing.steps.map((s) => s.dur)
    : (opts.durs ?? durations(opts.kind, ids.length, active, opts.dur));
  const guess = opts.kind === "attack" && opts.hit ? hitBox(rects, active) : null;

  // Hurt boxes are fitted to the sprite itself, so the atlas is read here.
  const atlasFile = path.join(process.cwd(), "assets", "atlases", `${opts.entity}.png`);
  let atlas: Rgba | null = null;
  try {
    atlas = decodePng(await fs.readFile(atlasFile));
  } catch (e) {
    console.log(
      `  note: ${path.relative(process.cwd(), atlasFile)} unreadable (${String(e)}) —\n` +
        "        hurt boxes fall back to one bounding box per frame",
    );
  }

  const steps: Step[] = ids.map((id, i) => {
    const boxes: DerivedBox[] = hurtFor(atlas, rects[i], opts.hurtBoxes, opts.inset);
    if (guess && i === active) boxes.push(guess.box);
    return { frame: id, dur: durs[i], ...(boxes.length ? { boxes } : {}) };
  });

  const loop = opts.loop ?? opts.kind === "loop";
  const existed = name in animations;
  animations[name] = { loop, steps };

  // Report: computed values on the left, guesses called out on the right.
  console.log(
    `${opts.entity} · ${name} · kind=${opts.kind} · loop=${loop} · ` +
      `hurt boxes ${atlas ? `${opts.hurtBoxes}/frame, fitted to the sprite` : "1/frame (no atlas)"}`,
  );
  steps.forEach((s, i) => {
    const mark = i === active && opts.kind === "attack" ? "*" : " ";
    const hurt = (s.boxes ?? []).filter((b) => b.type === "hurt");
    const hit = s.boxes?.find((b) => b.type === "hit");
    console.log(
      `${mark}${String(i).padStart(2)} ${s.frame.padEnd(10)} dur ${String(s.dur).padStart(2)}` +
        `  hurt ${fmtBoxes(hurt)}` +
        (hit ? `\n       hit  ${fmtBox(hit)}` : ""),
    );
  });
  console.log(
    `  total ${steps.reduce((n, s) => n + s.dur, 0)} frames` +
      (opts.kind === "attack" ? ` · active step ${active} (*)` : ""),
  );
  if (keepTiming) {
    console.log("  kept the existing durations (same frames) — --retime to recompute");
  } else if (existing) {
    const was = existing.steps.map((s) => `${s.frame}:${s.dur}`).join(" ");
    console.log(`  durations RESET to defaults — previous timing was  ${was}`);
  }
  if (guess) {
    console.log(
      guess.from === "extension"
        ? "  hit box measured from how far the active frame reaches beyond the others"
        : "  hit box is a FALLBACK — nothing measurably extends; check it by hand",
    );
  } else if (opts.kind === "attack") {
    console.log("  no hit box (--no-hit) — this attack cannot connect until one is added");
  }

  if (opts.dryRun) {
    console.log("  --dry-run: nothing written");
    return;
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(animsFile, JSON.stringify(animations, null, 2) + "\n");
  console.log(`  ${existed ? "replaced" : "added"} "${name}" in ${path.relative(process.cwd(), animsFile)}`);
  console.log("  timing and the hit box are guesses — adjust in the editor (Reload data first)");
}

void main();
