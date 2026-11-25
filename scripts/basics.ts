import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BASIC, withBasics, type BasicsFile } from "../src/entity/basics.ts";
import type { Anim } from "../src/entity/entityFile.ts";
import { generatedFighters } from "../src/rom/fighterStates.ts";

/**
 * `npm run basics` — each fighter's basic blows written into his
 * `animations.json` again from his `basics.json` (`src/entity/basics.ts`), as
 * `b_<name>`. After any change to a recipe; `basics.test.ts` fails until then.
 * `npm run basics -- goku` writes one.
 */

const names = process.argv[2] ? [process.argv[2]] : generatedFighters();
for (const name of names) {
  const recipes = `data/entities/${name}/basics.json`;
  if (!existsSync(recipes)) continue;
  const path = `data/entities/${name}/animations.json`;
  const anims = JSON.parse(readFileSync(path, "utf8")) as Record<string, Anim>;
  const made = withBasics(anims, JSON.parse(readFileSync(recipes, "utf8")) as BasicsFile);
  writeFileSync(path, JSON.stringify(made, null, 2) + "\n");
  console.log(`${name}: ${Object.keys(made).filter((a) => a.startsWith(BASIC)).join(" ")}`);
}
