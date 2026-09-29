import { readFileSync } from "node:fs";
import path from "node:path";
import { HIT_TYPES } from "../src/combat/hitTypes.ts";
import { isAmbiguous, readToken, type NotationData } from "../src/entity/notation.ts";

/**
 * `npm run which -- <entity> fl30 fl39 la187` — what a move written in the
 * shorthand points at: the hit type, the moves in the catalogue holding that
 * frame, and the animations (and states) that already play it.
 *
 * Prints; writes nothing. When a frame is in several moves or several
 * animations, all of them are listed — choosing is the owner's call.
 */

const [name, ...tokens] = process.argv.slice(2);
if (!name || tokens.length === 0) {
  console.error("usage: npm run which -- <entity> <code><frame>… (e.g. goku fl30 la187)");
  process.exit(1);
}

const dir = path.join("data", "entities", name);
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;

const data: NotationData = {
  groups: read<{ groups: NotationData["groups"] }>("descriptions.json").groups,
  animations: read<NotationData["animations"]>("animations.json"),
  states: read<{ states: NotationData["states"] }>("states.json").states,
  types: HIT_TYPES,
};

let failed = false;
for (const token of tokens) {
  const r = readToken(token, data);
  if ("error" in r) {
    console.log(`${token}  ✗ ${r.error}\n`);
    failed = true;
    continue;
  }
  console.log(`${token}  ${r.type ?? "(no type)"} · frame ${r.frame}`);
  const moves = r.moves.map((m) => `${m.name} (${m.frames.join(",")})`);
  const anims = r.animations.map((a) => `${a.name}${a.states.length ? ` ← ${a.states.join(", ")}` : ""}`);
  console.log(`  move${moves.length === 1 ? " " : "s"}       ${moves.join(" · ") || "— in no move of the catalogue"}`);
  console.log(`  animation${anims.length === 1 ? " " : "s"}  ${anims.join(" · ") || "— none plays it yet"}`);
  if (isAmbiguous(r)) console.log("  ? more than one — say which");
  console.log();
}
process.exit(failed ? 1 : 0);
