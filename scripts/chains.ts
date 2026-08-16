import { readFileSync } from "node:fs";
import path from "node:path";
import { chainLinks, type AnimSteps } from "../src/combat/chains";
import type { StatesFile } from "../src/entity/states";

/**
 * `npm run chains -- <entity>` — what cancels into what, and by how much.
 *
 * The picture the test cannot give: `npm test` says a link works or does not,
 * this says how many frames of room it has. That is the number you tune against,
 * and without it the loop is "guess, play, record, guess again".
 *
 * Prints; writes nothing. A committed table of links would be stale the first
 * time a number moved — see `docs/plan.md`.
 */

const name = process.argv[2] ?? "goku";
const dir = path.join("data", "entities", name);
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;

const states = read<StatesFile>("states.json");
const anims = read<Record<string, AnimSteps>>("animations.json");
const { hitstun } = read<{ hitstun: number }>("attributes.json");

const links = chainLinks(states, anims, hitstun);
if (links.length === 0) {
  console.log(`${name}: no chains — no transition asks for "cancelable"`);
  process.exit(0);
}

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
console.log(`${name} — ${links.length} cancels\n`);
console.log(
  pad("from", 14) + pad("on", 9) + pad("→ into", 16) + pad("window", 8) + pad("start-up", 10) + pad("latest hit", 12) + pad("hitstun", 9) + pad("depth", 7) + "margin",
);

for (const l of links.sort((a, b) => a.depth - b.depth || a.from.localeCompare(b.from))) {
  const verdict = l.launcher ? "  (launcher — chain ends here)" : l.margin < 0 ? "  ✗ DROPS" : "";
  console.log(
    pad(l.from, 14) +
      pad(l.on ?? "—", 9) +
      pad(`→ ${l.to}`, 16) +
      pad(l.window, 8) +
      pad(l.startup, 10) +
      pad(`+${l.worst}`, 12) +
      pad(l.hitstun, 9) +
      pad(l.depth, 7) +
      `${l.margin >= 0 ? "+" : ""}${l.margin}${verdict}`,
  );
}

console.log(
  "\nlatest hit = window + start-up: the most frames that can pass between this blow\n" +
    "and the next one, since the player decides when to press. It has to fit inside\n" +
    "the hitstun this blow still gives at its depth in the chain.",
);
