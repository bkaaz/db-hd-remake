/**
 * Every move of a fighter played in both games from the same pad, and what
 * differs (src/rom/moveCheck.ts):
 *
 *   npm run moves -- vegetto            both games, then the comparison
 *   npm run moves -- vegetto --original only Mesen (test runner, no window)
 *   npm run moves -- vegetto --ours     only our game, on the server already running
 *   npm run moves -- vegetto --only aa,9e
 *
 * He plays against a standing Goku in practice: player one in Mesen, where player
 * two's pad does nothing, and two in ours, where only two has a timeline. Results in `logs/moves/<fighter>/`. Ours needs Playwright, which is not a dependency:
 * PLAYWRIGHT names its directory.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { CommandsFile } from "../src/input/command.ts";
import { ROM_PATH } from "../src/rom/cartridge.ts";
import { afterInput, byMove, differences, moveCases, type MoveCase, type Stretch } from "../src/rom/moveCheck.ts";
import { runTable, type Scenario } from "../src/rom/run.ts";

const MESEN = process.env.MESEN ?? `${homedir()}/Downloads/Mesen.app/Contents/MacOS/Mesen`;
const PLAYWRIGHT = process.env.PLAYWRIGHT ?? `${homedir()}/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js`;
const AT_ONCE = 6;

const [fighter, ...flags] = process.argv.slice(2);
if (!fighter) throw new Error("npm run moves -- <fighter> [--original] [--ours] [--only a,b]");
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1].split(",") : null;
const both = !flags.includes("--original") && !flags.includes("--ours");
const dir = `logs/moves/${fighter}`;
mkdirSync(dir, { recursive: true });

const commands = (JSON.parse(readFileSync(`data/entities/${fighter}/commands.json`, "utf8")) as CommandsFile).commands;
const cases = moveCases(commands).filter((c) => !only || only.some((o) => c.name === o || c.name.startsWith(`${o} `)));
const fileOf = (c: MoveCase) => c.name.replace(/ /g, "-");

/** His face from Goku's at the roster's corner, for player one's cursor: `back` is right on this screen. */
const FACE: Record<string, [number, number]> = {
  goku: [0, 0], vegeta: [1, 0], gohan: [2, 0], gotenks: [3, 0], vegetto: [4, 0],
  piccolo: [0, 1], mr_buu: [1, 1], buu: [2, 1], freeza: [3, 1], cell: [4, 1],
};
/** And Goku for the COM cursor, four to the left of Vegetto's where it starts. */
const COM_TO_GOKU = ["fwd 3", 10, "fwd 3", 10, "fwd 3", 10, "fwd 3", 10];

function toFace(name: string): (string | number)[] {
  const [column, row] = FACE[name];
  const steps: (string | number)[] = row ? ["down 4", 15] : [];
  for (let i = 0; i < column; i++) steps.push("back 3", 10);
  return steps;
}

function mesen(scenario: Scenario, out: string): Promise<void> {
  const script = resolve(`${out}.lua`);
  const stateName = `raw/states/${scenario.state}.mss`;
  const table = runTable(
    { ...scenario, ...(scenario.saveTo && { saveTo: resolve(`raw/states/${scenario.saveTo}.mss`) }) },
    { state: resolve(stateName), out: resolve(out), shots: resolve(out) },
  );
  writeFileSync(script, table + readFileSync("tools/re/run.lua", "utf8") + readFileSync("tools/re/record-fight.lua", "utf8"));
  return new Promise((done, fail) => {
    const run = spawn(MESEN, ["--testRunner", resolve(ROM_PATH), script, "--timeout=120"], { stdio: "ignore" });
    run.on("exit", (code) => (code === 0 ? done() : fail(new Error(`Mesen stopped with ${code}: ${out}`))));
  });
}

/** The fight standing, kept as a state: from the roster it costs a thousand frames a run. */
async function fightState(): Promise<string> {
  const name = `fight-${fighter}`;
  if (existsSync(`raw/states/${name}.mss`)) return name;
  await mesen({
    state: "select-practice", frames: 1810, saveAt: 1800, saveTo: name,
    p1: { does: [10, ...toFace(fighter), 15, "blast 4", 40, ...COM_TO_GOKU, 20, "blast 4", 70, "blast 4", 70, "blast 4", 600, "blast 4", 80, "blast 4"] },
    shots: [1800],
  }, `${dir}/_fight.txt`);
  return name;
}

const FIGHTER = /^\s+(P[12]) (\S+)\s+\d+\s+\d+ \S+ x\s*(-?\d+) y\s*(-?\d+) /;
const SLOT = /^\s+slot (\d+): (\S\S) (\S\S)/;

interface Side { p1: Stretch[]; p2: Stretch[]; notes: string[] }

/** A record-fight log as stretches: a gap in the log is frames nothing happened on. */
function readOriginal(log: string): Side {
  const runs: Record<string, (Stretch & { x: number; y: number; at: number })[]> = { P1: [], P2: [] };
  const notes: string[] = [];
  const inSlot = new Map<string, string>();
  let frame = 0;
  let pause = 0;
  for (const line of log.split("\n")) {
    const at = /^f(\d+) hit=(\S\S)/.exec(line);
    if (at) {
      frame = Number(at[1]);
      const hit = parseInt(at[2], 16);
      if (hit && !pause) notes.push(`f${frame} pause ${at[2]}`);
      pause = hit;
    }
    const slot = SLOT.exec(line);
    if (slot) {
      const type = parseInt(slot[2], 16) & 0x0f;
      const kind = parseInt(slot[2], 16) ? `${type.toString(16).padStart(2, "0")}/${slot[3]}` : "";
      if (kind && inSlot.get(slot[1]) !== kind) notes.push(`f${frame} object ${kind}`);
      inSlot.set(slot[1], kind);
    }
    const m = FIGHTER.exec(line);
    if (!m) continue;
    const list = runs[m[1]];
    const [x, y] = [Number(m[3]), Number(m[4])];
    const last = list.at(-1);
    if (last?.move === m[2]) {
      last.frames = frame - last.at + 1;
      last.dx = x - last.x;
      last.dy = y - last.y;
    } else list.push({ move: m[2], frames: 1, dx: 0, dy: 0, x, y, at: frame });
  }
  const plain = (l: typeof runs.P1): Stretch[] => l.map(({ move, frames, dx, dy }) => ({ move, frames, dx, dy }));
  // he is player one here and two in ours: a mirror, as a round opens the same way round the middle
  const mirrored = (l: Stretch[]) => l.map((r) => ({ ...r, dx: -r.dx }));
  return { p1: mirrored(plain(runs.P2)), p2: mirrored(plain(runs.P1)), notes };
}

async function playOriginal(): Promise<void> {
  const state = await fightState();
  const queue = [...cases];
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const out = `${dir}/${fileOf(c)}.orig.txt`;
      const frames = c.does.reduce<number>((n, t) => n + (typeof t === "number" ? t : Number(t.split(" ").at(-1))), 0) + 500;
      await mesen({ state, frames, hp1: 80, p1: { does: c.does } }, out);
      writeFileSync(`${dir}/${fileOf(c)}.orig.json`, JSON.stringify(readOriginal(readFileSync(out, "utf8"))));
      console.log(`original ${c.name}`);
    }
  }));
}

/** State name → the move its animation belongs to, so that the two games' names meet. */
function movesOf(name: string): (state: string) => string {
  const states = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")).states as Record<string, { anim?: string }>;
  return (state) => /^m([0-9a-f]{2})/.exec(states[state]?.anim ?? "")?.[1] ?? state;
}

const LINE = /^(\d+) \+\s*\d+\s+P1 (\S+)\s+@(-?\d+),(-?\d+) .*?P2 (\S+)\s+@(-?\d+),(-?\d+) .*?\| (.*)$/;

function readOurs(lines: string[]): Side {
  const moves = { p1: movesOf("goku"), p2: movesOf(fighter) };
  const open: Record<"p1" | "p2", { state: string; at: number; x: number; y: number } | null> = { p1: null, p2: null };
  const out: Side = { p1: [], p2: [], notes: [] };
  for (const line of lines) {
    const m = LINE.exec(line);
    if (!m) {
      const bolt = /^(\d+) .*?(bolt \S+ out)/.exec(line);
      if (bolt) out.notes.push(`f${bolt[1]} ${bolt[2]}`);
      continue;
    }
    const frame = Number(m[1]);
    if (m[8].includes("HITS") || m[8].includes("BLOCKED")) out.notes.push(`f${frame} ${m[8]}`);
    const now = { p1: { state: m[2], x: Number(m[3]), y: Number(m[4]) }, p2: { state: m[5], x: Number(m[6]), y: Number(m[7]) } };
    for (const who of ["p1", "p2"] as const) {
      const was = open[who];
      if (was && was.state !== now[who].state) {
        out[who].push({ move: moves[who](was.state), frames: frame - was.at, dx: now[who].x - was.x, dy: now[who].y - was.y });
      }
      if (!was || was.state !== now[who].state) open[who] = { ...now[who], at: frame };
    }
  }
  return out;
}

async function playOurs(): Promise<void> {
  const { chromium } = (await import(PLAYWRIGHT)).default;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  await page.addInitScript(() => localStorage.setItem("db-hd-remake.toggles", JSON.stringify({ boxes: false, readout: false, dummy: false, intro: false, ko: false })));
  let lines: string[] = [];
  let mode: unknown = {};
  await page.route("**/api/log", async (route: { request(): { postDataJSON(): { lines: string[] } }; fulfill(o: object): Promise<void> }) => {
    lines.push(...route.request().postDataJSON().lines);
    await route.fulfill({ status: 200, body: "{}" });
  });
  await page.route("**/api/debug", (route: { fulfill(o: object): Promise<void> }) => route.fulfill({ json: { modes: [{}, {}, {}, {}, {}, mode] } }));
  for (const c of cases) {
    lines = [];
    mode = { p2: { does: c.does, loop: false } };
    await page.goto(`http://localhost:5173/?scene=debug&mode=5&p1=goku&p2=${fighter}&hp2=80&arena=tournament`);
    await page.waitForSelector("canvas");
    await page.waitForTimeout(700);
    await page.keyboard.press("l");
    await page.waitForTimeout(100);
    await page.keyboard.press("t");
    const lead = c.does.reduce<number>((n, t) => n + (typeof t === "number" && t < 100 ? t : typeof t === "string" ? Number(t.split(" ").at(-1)) : 0), 0);
    const started = Date.now();
    // over once he has left what led up to it, come back, and nothing has happened for a second
    for (;;) {
      await page.waitForTimeout(500);
      const side = readOurs(lines);
      const back = afterInput(side.p2, c.before).length > 0 && side.p2.at(-1)?.move !== undefined && lines.at(-1) !== undefined;
      const quiet = lines.length > 0 && back && /\|.*→ idle/.test(lines.filter((l) => l.includes("P2 ") && l.includes("→")).at(-1) ?? "");
      if (quiet || Date.now() - started > (lead / 60) * 1000 + 16000) break;
    }
    await page.waitForTimeout(1500);
    await page.keyboard.press("l");
    await page.waitForTimeout(250);
    writeFileSync(`${dir}/${fileOf(c)}.ours.txt`, lines.join("\n"));
    writeFileSync(`${dir}/${fileOf(c)}.ours.json`, JSON.stringify(readOurs(lines)));
    console.log(`ours ${c.name}`);
  }
  await browser.close();
}

function show(runs: Stretch[]): string {
  return byMove(runs).map((r) => `${r.move}:${r.frames}${r.dx ? ` x${r.dx > 0 ? "+" : ""}${r.dx}` : ""}${r.dy ? ` y${r.dy > 0 ? "+" : ""}${r.dy}` : ""}`).join("  ") || "—";
}

function report(): void {
  const table: string[] = [];
  let same = 0;
  for (const c of cases) {
    const [origin, ours] = ["orig", "ours"].map((s) => `${dir}/${fileOf(c)}.${s}.json`);
    if (!existsSync(origin) || !existsSync(ours)) continue;
    const a = JSON.parse(readFileSync(origin, "utf8")) as Side;
    const b = JSON.parse(readFileSync(ours, "utf8")) as Side;
    const off = [
      ...differences(afterInput(a.p2, c.before), afterInput(b.p2, c.before)),
      ...differences(afterInput(a.p1, ["00"]), afterInput(b.p1, ["00"])).map((l) => `P1 ${l}`),
    ];
    if (off.length === 0) same++;
    table.push(`${off.length ? "≠" : "="} ${c.name}`);
    table.push(`    orig ${show(afterInput(a.p2, c.before))}   | P1 ${show(afterInput(a.p1, ["00"]))}`);
    table.push(`    ours ${show(afterInput(b.p2, c.before))}   | P1 ${show(afterInput(b.p1, ["00"]))}`);
    table.push(`    orig ${a.notes.slice(0, 8).join(", ")}`);
    table.push(`    ours ${b.notes.slice(0, 8).join(", ")}`);
    for (const l of off) table.push(`    ! ${l}`);
  }
  table.unshift(`${fighter}: ${same} of ${cases.length} agree`);
  writeFileSync(`${dir}/report.txt`, table.join("\n") + "\n");
  console.log(`${table[0]} — ${dir}/report.txt`);
}

async function main(): Promise<void> {
  if (both || flags.includes("--original")) await playOriginal();
  if (both || flags.includes("--ours")) await playOurs();
  report();
}

void main();
