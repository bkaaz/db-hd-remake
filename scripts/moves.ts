/**
 * Every move of a fighter played in both games from the same pad, and what
 * differs (src/rom/moveCheck.ts):
 *
 *   npm run moves -- vegetto            both games, then the comparison
 *   npm run moves -- vegetto --original only Mesen (test runner, no window)
 *   npm run moves -- vegetto --ours     only our game, on the server already running
 *   npm run moves -- vegetto --only aa,9e  prints the comparison instead of writing it
 *   npm run moves -- vegetto --far      his commands from where the round starts: a shot's flight
 *   npm run moves -- vegetto --close    his commands from arm's length: what a blow that lands opens
 *   npm run moves -- vegetto --report   the comparison again, nothing played
 *   npm run moves -- vegetto --objects  his objects recorded, into logs/objects-vegetto.*
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
import { afterInput, byMove, closeCases, differences, farCases, moveCases, readFight, type CommandNeeds, type MoveCase, type Stretch } from "../src/rom/moveCheck.ts";
import { ROM_PATH } from "../src/rom/cartridge.ts";
import { readCommands } from "../src/rom/commands.ts";
import { commandContext, rowNeeds } from "../src/rom/conditions.ts";
import { fighterNamed } from "../src/rom/roster.ts";
import { runTable, type Scenario } from "../src/rom/run.ts";

const MESEN = process.env.MESEN ?? `${homedir()}/Downloads/Mesen.app/Contents/MacOS/Mesen`;
const PLAYWRIGHT = process.env.PLAYWRIGHT ?? `${homedir()}/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js`;
const AT_ONCE = 6;

const [fighter, ...flags] = process.argv.slice(2);
if (!fighter) throw new Error("npm run moves -- <fighter> [--original] [--ours] [--only a,b]");
const only = flags.includes("--only") ? flags[flags.indexOf("--only") + 1].split(",") : null;
const both = !flags.includes("--original") && !flags.includes("--ours") && !flags.includes("--report");
const dir = `logs/moves/${fighter}`;
mkdirSync(dir, { recursive: true });

const commands = (JSON.parse(readFileSync(`data/entities/${fighter}/commands.json`, "utf8")) as CommandsFile).commands;
const rom = new Uint8Array(readFileSync(ROM_PATH));
const { character } = fighterNamed(rom, fighter);
const context = commandContext(rom, character);
const hex = (n: number) => n.toString(16).padStart(2, "0");
const needs: Record<string, CommandNeeds> = Object.fromEntries(
  readCommands(rom, character).map((c) => {
    const { after, ...rest } = rowNeeds(c.conditions, context);
    return [hex(c.move), { ...rest, ...(after !== undefined && { after: hex(after) }) }];
  }),
);
const cases = (flags.includes("--far") ? farCases(commands, needs) : flags.includes("--close") ? closeCases(commands, needs) : moveCases(commands, needs)).filter((c) => !only || only.some((o) => c.name === o || c.name.startsWith(`${o} `)));
const fileOf = (c: MoveCase) => c.name.replace(/ /g, "-");

/** His face from Goku's at the roster's corner, for player one's cursor: `back` is right on this screen. */
const FACE: Record<string, [number, number]> = {
  goku: [0, 0], vegeta: [1, 0], gotenks: [2, 0], gohan: [3, 0], vegetto: [4, 0],
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

/**
 * The fight standing, kept as a state: from the roster it costs two thousand frames a run. Blast
 * presses go through the config and the arena's screen; too few and the round never opens, too
 * many and one is a ki blast in it, so he takes the first count that leaves both standing apart.
 */
async function fightState(): Promise<string> {
  const name = `fight-${fighter}`;
  if (existsSync(`raw/states/${name}.mss`)) return name;
  const log = `${dir}/_fight.txt`;
  for (let presses = 10; presses <= 30; presses++) {
    await mesen({
      state: "select-practice", frames: 2610, saveAt: 2600, saveTo: name,
      p1: { does: [10, ...toFace(fighter), 15, "blast 4", 40, ...COM_TO_GOKU, 20, ...Array.from({ length: presses }, () => ["blast 3", 42]).flat()] },
      shots: [2600],
    }, log);
    const fight = readFileSync(log, "utf8").split("\n");
    const last = (who: string) => fight.filter((l) => l.startsWith(`  ${who} `)).at(-1) ?? "";
    // `fa` is the round opening: before it the two stand as idly on the config's screen
    const opened = fight.some((l) => l.startsWith("  P1 fa "));
    if (opened && / 00 .* x 192 /.test(last("P1")) && / 00 .* x 320 /.test(last("P2"))) return name;
  }
  throw new Error(`no count of presses opened a round for ${fighter}`);
}

interface Side { p1: Stretch[]; p2: Stretch[]; notes: string[] }

/** He is player one in Mesen and two in ours: a mirror, as a round opens the same way round the middle. */
function readOriginal(log: string): Side {
  const fight = readFight(log);
  const mirrored = (l: Stretch[]) => l.map((r) => ({ ...r, dx: -r.dx }));
  return { p1: mirrored(fight.P2), p2: mirrored(fight.P1), notes: fight.notes };
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
  return (state) => (state === "held" ? "30" : (/^m([0-9a-f]{2})/.exec(states[state]?.anim ?? "")?.[1] ?? state));
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

/**
 * `record-objects.lua` over all his moves, into what `rom -- objects` and `rom -- vram` read (ADR 0036):
 * each command alone from where a round opens, whose bolt may fly its whole life, then the lot close
 * up. A run writes `logs/objects-rec.*` alone, so they go one at a time and the logs are joined.
 */
async function recordObjects(): Promise<void> {
  const state = await fightState();
  const length = (does: (string | number)[]) => does.reduce<number>((n, t) => n + (typeof t === "number" ? t : Number(t.split(" ").at(-1))), 0);
  const moving = (c: MoveCase) => !c.name.startsWith("jump") && !c.name.startsWith("dash") && c.name !== "charge";
  const far = cases.filter((c) => moving(c) && !c.name.includes(" ")).map((c) => c.does.filter((t) => t !== "fwd 46").map((t) => (t === 300 ? 460 : t)));
  const close = cases.filter(moving).flatMap((c) => [...c.does.slice(0, -1), 240]);
  const logs: Buffer[] = [];
  const bins: Buffer[] = [];
  for (const does of [...far, close]) {
    const script = resolve(`${dir}/objects.lua`);
    const table = runTable({ state, frames: length(does) + 60, hp1: 80, p1: { does } }, { state: resolve(`raw/states/${state}.mss`), out: "", shots: "" });
    const drive = `\nlocal playing = 0\nemu.addEventCallback(function()\n  if not RUN.frame() then return end\n  playing = playing + 1\n  if playing >= RUN.frames then emu.stop(0) end\nend, emu.eventType.endFrame)\n`;
    writeFileSync(script, table + readFileSync("tools/re/run.lua", "utf8") + drive + readFileSync("tools/re/record-objects.lua", "utf8"));
    await new Promise<void>((done, fail) => {
      const run = spawn(MESEN, ["--testRunner", resolve(ROM_PATH), script, "--timeout=280"], { stdio: "ignore" });
      run.on("exit", (code) => (code === 0 ? done() : fail(new Error(`Mesen stopped with ${code}`))));
    });
    logs.push(readFileSync("logs/objects-rec.txt"));
    bins.push(readFileSync("logs/objects-rec.bin"));
  }
  writeFileSync(`logs/objects-${fighter}.txt`, Buffer.concat(logs));
  writeFileSync(`logs/objects-${fighter}.bin`, Buffer.concat(bins));
  console.log(`logs/objects-${fighter}.txt`);
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
  // a part of a fighter says what it found here and leaves his whole report as it was
  if (only) console.log(table.join("\n"));
  else writeFileSync(`${dir}/report.txt`, table.join("\n") + "\n");
  console.log(`${table[0]} — ${dir}/report.txt`);
}

async function main(): Promise<void> {
  if (flags.includes("--objects")) return recordObjects();
  const reporting = flags.includes("--report");
  if (!reporting && (both || flags.includes("--original"))) await playOriginal();
  if (!reporting && (both || flags.includes("--ours"))) await playOurs();
  report();
}

void main();
