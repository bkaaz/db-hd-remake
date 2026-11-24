import { writeFileSync } from "node:fs";
import { composeStates } from "../src/rom/compose.ts";
import { generatedFighters } from "../src/rom/fighterStates.ts";

/**
 * `npm run states` — every fighter's `states.json` written again from our own
 * files: the common states, his overrides and specials (`src/rom/compose.ts`).
 * Needs no cartridge; `npm run rom -- states` says where the cartridge differs.
 * `npm run states -- vegeta` writes one.
 */

const only = process.argv[2];
for (const name of only ? [only] : generatedFighters()) {
  const file = composeStates(name);
  writeFileSync(`data/entities/${name}/states.json`, JSON.stringify(file, null, 2) + "\n");
  console.log(`${name}: ${Object.keys(file.states).length} states`);
}
