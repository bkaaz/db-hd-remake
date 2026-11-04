/**
 * The original, played from a terminal with no window (ADR 0074):
 *
 *   npm run original -- volleyball-hit
 *
 * Plays `tools/re/runs/<name>.json` from its save state in Mesen's test runner,
 * writes `logs/run-<name>.txt` in record-fight.lua's format and prints what
 * each fighter did. The owner's open Mesen is left alone.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ROM_PATH } from "../src/rom/cartridge.ts";
import { moveRuns, objectsSeen } from "../src/rom/fightLog.ts";
import { runTable, type Scenario } from "../src/rom/run.ts";

const MESEN = process.env.MESEN ?? `${homedir()}/Downloads/Mesen.app/Contents/MacOS/Mesen`;
const TIMEOUT_SECONDS = 60;

const [name] = process.argv.slice(2);
if (!name) throw new Error("npm run original -- <name>: a scenario of tools/re/runs/");
const scenario = JSON.parse(readFileSync(`tools/re/runs/${name}.json`, "utf8")) as Scenario;
const state = resolve(`raw/states/${scenario.state}.mss`);
if (!existsSync(state)) throw new Error(`${state} is missing: a save state from Mesen's SaveStates folder`);
const out = resolve(`logs/run-${name}.txt`);

const script = resolve("logs/run-script.lua");
writeFileSync(script, runTable(scenario, { state, out }) + readFileSync("tools/re/run.lua", "utf8") + readFileSync("tools/re/record-fight.lua", "utf8"));
const run = spawnSync(MESEN, ["--testRunner", resolve(ROM_PATH), script, `--timeout=${TIMEOUT_SECONDS}`], { stdio: "ignore" });
if (run.status !== 0) throw new Error(`Mesen stopped with ${run.status}: the scenario did not reach its last frame`);

const log = readFileSync(out, "utf8");
for (const who of ["P1", "P2"] as const) {
  console.log(who);
  for (const r of moveRuns(log, who)) {
    const hp = r.hp[0] !== r.hp[1] ? `  hp ${r.hp[0]}→${r.hp[1]}` : "";
    console.log(`  f${r.from}–${r.to}  ${r.move}  x ${r.x[0]}→${r.x[1]}  y ${r.y[0]}→${r.y[1]}${hp}`);
  }
}
console.log("objects");
for (const o of objectsSeen(log)) console.log(`  f${o.frame}  slot ${o.slot}  ${o.kind}`);
console.log(`in ${out}`);
