import type { CommandDef } from "../input/command";
import { PAD } from "../input/command";

/**
 * One input played in both games and what came of it: the cases `npm run moves`
 * walks through for a fighter, and the comparison of the two runs. A command's
 * input is its own words read backwards; what it cannot tell comes from the
 * normals every fighter shares. Pure: `scripts/moves.ts` runs it.
 */

export interface MoveCase {
  name: string;
  /** Dummy tokens, from the moment the fight stands. */
  does: (string | number)[];
  /** Moves that lead up to it and are not it: the summary starts past them. */
  before: string[];
}

const WALK = ["00", "01", "02"];
const CROUCH = [...WALK, "03", "04", "05", "06", "07", "3b"];
const JUMP = [...WALK, "05", "06", "07", "08", "09", "3b"];
/** Close enough that a blow lands, as `fwd` walks from where a round opens. Mesen takes a few frames to answer a state just loaded. */
const NEAR = [20, "fwd 46", 8];

function direction(high: number): string {
  const up = (high << 8) & PAD.up ? "up " : "";
  const down = (high << 8) & PAD.down ? "down " : "";
  const back = (high << 8) & PAD.back ? "back " : "";
  const fwd = (high << 8) & PAD.fwd ? "fwd " : "";
  return `${up}${down}${back}${fwd}`;
}

function button(word: number): string {
  const names: [number, string][] = [[PAD.Y, "attack"], [PAD.B, "smash"], [PAD.X, "strike"], [PAD.A, "blast"], [PAD.R, "dash"]];
  return names.filter(([bit]) => word & bit).map(([, name]) => name).join(" ");
}

/** What a command's words ask of the pad: each direction three frames, the newest once more with the button. */
export function commandTokens(words: string[]): string[] {
  const [buttonWord, ...newestFirst] = words.map((w) => parseInt(w, 16));
  const oldestFirst = newestFirst.reverse();
  const stick = oldestFirst.map((w) => direction(w >> 8));
  const last = stick.at(-1) ?? direction(buttonWord >> 8);
  // a charge (bit 0, `input/command.ts`) is held 48 frames; a stick going up leaves the floor if it waits
  const held = (s: string, i: number) => `${s}${oldestFirst[i] & 1 ? 50 : i === stick.length - 1 && s.startsWith("up") ? 1 : 3}`;
  return [...stick.map(held), `${last}${button(buttonWord)} 3`];
}

const NORMALS: Record<string, string> = { y: "attack", b: "smash", x: "strike", a: "blast" };

/** How he gets about: the jumps, the dash both ways, the charge. Nothing leads up to them. */
const MOVING: MoveCase[] = [
  { name: "jump up", does: [20, "up 3", 90], before: WALK },
  { name: "jump fwd", does: [20, "up fwd 3", 90], before: WALK },
  { name: "jump back", does: [20, "up back 3", 90], before: WALK },
  { name: "dash fwd", does: [20, "dash fwd 30", 60], before: ["00"] },
  { name: "dash back", does: [20, "dash back 30", 60], before: ["00"] },
  { name: "charge", does: [20, "attack smash 40", 60], before: ["00"] },
];

/** Every command near the opponent, then the four buttons near and far, crouching and in the air; then how he gets about. */
export function moveCases(commands: CommandDef[]): MoveCase[] {
  const cases: MoveCase[] = commands.map((c) =>
    c.where === "air"
      ? { name: `${c.move} air`, does: [...NEAR, "up fwd 3", 14, ...commandTokens(c.words), 300], before: JUMP }
      : { name: c.move, does: [...NEAR, ...commandTokens(c.words), 300], before: CROUCH },
  );
  for (const [key, token] of Object.entries(NORMALS)) {
    cases.push({ name: `${key} close`, does: [20, "fwd 75", 8, `${token} 3`, 200], before: WALK });
    cases.push({ name: `${key} near`, does: [...NEAR, `${token} 3`, 200], before: WALK });
    cases.push({ name: `${key} far`, does: [20, `${token} 3`, 200], before: WALK });
    cases.push({ name: `${key} crouching`, does: [...NEAR, "down 8", `down ${token} 3`, 200], before: CROUCH });
    cases.push({ name: `${key} air`, does: [...NEAR, "up fwd 3", 14, `${token} 3`, 200], before: JUMP });
  }
  return [...cases, ...MOVING];
}

/**
 * Each ground command from where the round starts, not walked up to: what a shot
 * does in flight only shows with room to fly. Apart from `moveCases`, whose
 * counts are the ones a fighter is judged by, as it doubles the run.
 */
export function farCases(commands: CommandDef[]): MoveCase[] {
  return commands
    .filter((c) => c.where !== "air")
    .map((c) => ({ name: `${c.move} far`, does: [20, ...commandTokens(c.words), 300], before: CROUCH }));
}

/** One stretch of a move in either game. `frames` counts a hit pause, as both games do. */
export interface Stretch {
  move: string;
  frames: number;
  dx: number;
  dy: number;
}

const FIGHTER = /^\s+(P[12]) (\S+)\s+\d+\s+\d+ \S+ x\s*(-?\d+) y\s*(-?\d+) /;
const SLOT = /^\s+slot (\d+): (\S\S) (\S\S)/;

export interface Fight {
  P1: Stretch[];
  P2: Stretch[];
  notes: string[];
}

/**
 * A record-fight log as stretches. A frame on which neither body changed and
 * the pause stood is one the game had no time for (the SA-1 slows it): not a
 * frame of any move, and our game has none, so it is left out rather than
 * compared. A dash's 30 frames are 24 of the game's where it is at its slowest.
 */
export function readFight(log: string): Fight {
  const fight: Fight = { P1: [], P2: [], notes: [] };
  const open = { P1: { x: 0, y: 0 }, P2: { x: 0, y: 0 } };
  const inSlot = new Map<string, string>();
  let frame = 0;
  let pause = 0;
  let before = "";
  const frames: { n: number; lines: string[] }[] = [];
  for (const line of log.split("\n")) {
    const at = /^f(\d+) hit=/.exec(line);
    if (at) frames.push({ n: Number(at[1]), lines: [line] });
    else frames.at(-1)?.lines.push(line);
  }
  for (const { n, lines } of frames) {
    frame = n;
    const hitField = /hit=(\S\S)/.exec(lines[0])?.[1] ?? "00";
    const hit = parseInt(hitField, 16);
    if (hit && !pause) fight.notes.push(`f${frame} pause ${hitField}`);
    pause = hit;
    const bodies = lines.filter((l) => FIGHTER.test(l));
    const key = hitField + bodies.join("");
    const lag = key === before;
    before = key;
    for (const line of lines) {
      const slot = SLOT.exec(line);
      if (!slot) continue;
      const kind = parseInt(slot[2], 16) ? `${(parseInt(slot[2], 16) & 0x0f).toString(16).padStart(2, "0")}/${slot[3]}` : "";
      if (kind && inSlot.get(slot[1]) !== kind) fight.notes.push(`f${frame} object ${kind}`);
      inSlot.set(slot[1], kind);
    }
    if (lag) continue;
    for (const line of bodies) {
      const m = FIGHTER.exec(line);
      if (!m) continue;
      const who = m[1] as "P1" | "P2";
      const [x, y] = [Number(m[3]), Number(m[4])];
      const last = fight[who].at(-1);
      if (last?.move === m[2]) {
        last.frames++;
        last.dx = x - open[who].x;
        last.dy = y - open[who].y;
      } else {
        fight[who].push({ move: m[2], frames: 1, dx: 0, dy: 0 });
        open[who] = { x, y };
      }
    }
  }
  return fight;
}

/** What a run shows of one fighter: `before` left out, up to his return to `00` and no further. */
export function afterInput(runs: Stretch[], before: string[]): Stretch[] {
  const from = runs.findIndex((r) => !before.includes(r.move));
  if (from < 0) return [];
  const end = runs.findIndex((r, i) => i > from && r.move === "00");
  return runs.slice(from, end < 0 ? undefined : end);
}

/** The reels' second poses, which ours does not pick yet (docs/bugs.md): the same reel, not a difference. */
const SAME_REEL: Record<string, string> = { "13": "15", "14": "16", "17": "18" };

/** Two fighters' stretches, merged by move so that a part cut differently does not read as a difference. */
export function byMove(runs: Stretch[]): Stretch[] {
  const out: Stretch[] = [];
  for (const run of runs) {
    const r = { ...run, move: SAME_REEL[run.move] ?? run.move };
    const last = out.at(-1);
    if (last?.move === r.move) {
      last.frames += r.frames;
      last.dx += r.dx;
      last.dy += r.dy;
    } else out.push({ ...r });
  }
  return out;
}

/** What differs between two runs of a case, in words; empty when they agree within `slack` frames and px. */
export function differences(original: Stretch[], ours: Stretch[], slack = 2): string[] {
  const lines: string[] = [];
  const [a, b] = [byMove(original), byMove(ours)];
  if (a.map((r) => r.move).join() !== b.map((r) => r.move).join()) {
    lines.push(`moves ${a.map((r) => r.move).join(" ") || "none"} / ours ${b.map((r) => r.move).join(" ") || "none"}`);
    return lines;
  }
  a.forEach((r, i) => {
    const o = b[i];
    if (Math.abs(r.frames - o.frames) > slack) lines.push(`${r.move} lasts ${r.frames} / ours ${o.frames}`);
    if (Math.abs(r.dx - o.dx) > slack + 3) lines.push(`${r.move} moves x ${r.dx} / ours ${o.dx}`);
    // a body's last height in the air, a frame before the landing's line
    if (Math.abs(r.dy - o.dy) > slack + 9) lines.push(`${r.move} moves y ${r.dy} / ours ${o.dy}`);
  });
  return lines;
}
