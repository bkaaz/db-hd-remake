import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { StatesFile } from "../src/entity/states.ts";
import { COMMON, composeStates } from "../src/rom/compose.ts";
import { generatedFighters } from "../src/rom/fighterStates.ts";
import { fingerprint, staleCopies, type SpecialsFile } from "../src/rom/specials.ts";

/**
 * `npm run states` — every fighter's `states.json` written again from our own
 * files: the common states, his overrides and specials (`src/rom/compose.ts`).
 * Needs no cartridge; `npm run rom -- states` says where the cartridge differs.
 * `npm run states -- vegeta` writes one.
 *
 * A copy he `replaces` whose common state changed since it was checked is
 * named, and `compose.test.ts` fails, until it is looked at and accepted:
 * `npm run states -- --accept vegeta attack_b`.
 */

const common = JSON.parse(readFileSync(COMMON, "utf8")) as StatesFile;
const args = process.argv.slice(2);

if (args[0] === "--accept") {
  const [, name, state] = args;
  const path = `data/entities/${name}/specials.json`;
  const text = readFileSync(path, "utf8");
  const was = (JSON.parse(text) as SpecialsFile).replaces?.[state];
  if (was === undefined) throw new Error(`${name} replaces no "${state}"`);
  // in place, as the rest of a file by hand is laid out by hand
  writeFileSync(path, text.replace(`"${state}": "${was}"`, `"${state}": "${fingerprint(common.states[state])}"`));
  console.log(`${name}'s ${state}: checked against the common state as it is now`);
} else {
  for (const name of args[0] ? [args[0]] : generatedFighters()) {
    const file = composeStates(name);
    writeFileSync(`data/entities/${name}/states.json`, JSON.stringify(file, null, 2) + "\n");
    console.log(`${name}: ${Object.keys(file.states).length} states`);
    const path = `data/entities/${name}/specials.json`;
    for (const state of existsSync(path) ? staleCopies(common, JSON.parse(readFileSync(path, "utf8")) as SpecialsFile) : []) {
      console.log(`  his ${state} is a copy, and the common ${state} has changed since: git log -p -- ${COMMON},`);
      console.log(`  bring it over or not, then npm run states -- --accept ${name} ${state}`);
    }
  }
}
