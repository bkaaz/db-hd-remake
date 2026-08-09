/**
 * Build an animation from a list of frames, with boxes and timing derived from
 * the sprites (see src/boxes.ts).
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
  type AnimKind,
  type DerivedBox,
  type FrameRect,
} from "../src/boxes.ts";
import { validateStates, type StatesFile } from "../src/states.ts";

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
  inset: number;
  loop?: boolean;
  hit: boolean;
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
    hit: true,
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
      case "--inset":
        opts.inset = Number(next());
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

/** Accept "42", "frame_42" or any literal frame id that exists. */
function resolveFrameId(token: string, frames: Record<string, FrameRect>): string {
  if (frames[token]) return token;
  const numbered = `frame_${token}`;
  if (frames[numbered]) return numbered;
  return die(`no frame "${token}" (tried "${numbered}" too) in frames.json`);
}

const fmtBox = (b: DerivedBox | null | undefined): string =>
  b ? `${b.x},${b.y} ${b.w}x${b.h}` : "—";

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

  const ids = opts.frames.map((t) => resolveFrameId(t, frames));
  const rects = ids.map((id) => frames[id]);
  const active = activeIndex(rects);
  const durs = durations(opts.kind, ids.length, active, opts.dur);
  const guess = opts.kind === "attack" && opts.hit ? hitBox(rects, active) : null;

  const steps: Step[] = ids.map((id, i) => {
    const boxes: DerivedBox[] = [];
    const hurt = hurtBox(rects[i], opts.inset);
    if (hurt) boxes.push(hurt);
    if (guess && i === active) boxes.push(guess.box);
    return { frame: id, dur: durs[i], ...(boxes.length ? { boxes } : {}) };
  });

  const loop = opts.loop ?? opts.kind === "loop";
  const existed = name in animations;
  animations[name] = { loop, steps };

  // Report: computed values on the left, guesses called out on the right.
  console.log(`${opts.entity} · ${name} · kind=${opts.kind} · loop=${loop}`);
  console.log("  #  frame          dur  hurt (computed)        hit (placeholder)");
  steps.forEach((s, i) => {
    const hit = s.boxes?.find((b) => b.type === "hit");
    const mark = i === active && opts.kind === "attack" ? "*" : " ";
    console.log(
      `${mark}${String(i).padStart(2)}  ${s.frame.padEnd(14)}${String(s.dur).padStart(3)}  ` +
        `${fmtBox(s.boxes?.find((b) => b.type === "hurt")).padEnd(22)} ${fmtBox(hit)}`,
    );
  });
  console.log(
    `  total ${steps.reduce((n, s) => n + s.dur, 0)} frames` +
      (opts.kind === "attack" ? ` · active step ${active} (*)` : ""),
  );
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
