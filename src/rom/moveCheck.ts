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
const CROUCH = [...WALK, "03", "04"];
const JUMP = [...WALK, "05", "06", "07", "08", "09", "3b"];
/** Close enough that a blow lands, as `fwd` walks from where a round opens. */
const NEAR = ["fwd 50", 8];

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
  const stick = newestFirst.reverse().map((w) => direction(w >> 8));
  const last = stick.at(-1) ?? direction(buttonWord >> 8);
  return [...stick.map((s) => `${s}3`), `${last}${button(buttonWord)} 3`];
}

const NORMALS: Record<string, string> = { y: "attack", b: "smash", x: "strike", a: "blast" };

/** How he gets about: the jumps, the dash both ways, the charge. Nothing leads up to them. */
const MOVING: MoveCase[] = [
  { name: "jump up", does: ["up 3", 90], before: ["00"] },
  { name: "jump fwd", does: ["up fwd 3", 90], before: ["00"] },
  { name: "jump back", does: ["up back 3", 90], before: ["00"] },
  { name: "dash fwd", does: ["dash fwd 30", 60], before: ["00"] },
  { name: "dash back", does: ["dash back 30", 60], before: ["00"] },
  { name: "charge", does: ["attack smash 40", 60], before: ["00"] },
];

/** Every command near the opponent, then the four buttons near and far, crouching and in the air; then how he gets about. */
export function moveCases(commands: CommandDef[]): MoveCase[] {
  const cases: MoveCase[] = commands.map((c) =>
    c.where === "air"
      ? { name: `${c.move} air`, does: [...NEAR, "up fwd 3", 14, ...commandTokens(c.words), 300], before: JUMP }
      : { name: c.move, does: [...NEAR, ...commandTokens(c.words), 300], before: CROUCH },
  );
  for (const [key, token] of Object.entries(NORMALS)) {
    cases.push({ name: `${key} near`, does: [...NEAR, `${token} 3`, 200], before: WALK });
    cases.push({ name: `${key} far`, does: [`${token} 3`, 200], before: WALK });
    cases.push({ name: `${key} crouching`, does: [...NEAR, "down 8", `down ${token} 3`, 200], before: CROUCH });
    cases.push({ name: `${key} air`, does: [...NEAR, "up fwd 3", 14, `${token} 3`, 200], before: JUMP });
  }
  return [...cases, ...MOVING];
}

/** One stretch of a move in either game. `frames` counts a hit pause, as both games do. */
export interface Stretch {
  move: string;
  frames: number;
  dx: number;
  dy: number;
}

/** What a run shows of one fighter: `before` left out, up to his return to `00` and no further. */
export function afterInput(runs: Stretch[], before: string[]): Stretch[] {
  const from = runs.findIndex((r) => !before.includes(r.move));
  if (from < 0) return [];
  const end = runs.findIndex((r, i) => i > from && r.move === "00");
  return runs.slice(from, end < 0 ? undefined : end);
}

/** Two fighters' stretches, merged by move so that a part cut differently does not read as a difference. */
export function byMove(runs: Stretch[]): Stretch[] {
  const out: Stretch[] = [];
  for (const r of runs) {
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
    if (Math.abs(r.dx - o.dx) > slack + 1) lines.push(`${r.move} moves x ${r.dx} / ours ${o.dx}`);
    if (Math.abs(r.dy - o.dy) > slack + 1) lines.push(`${r.move} moves y ${r.dy} / ours ${o.dy}`);
  });
  return lines;
}
