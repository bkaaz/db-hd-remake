import { readFileSync } from "node:fs";
import path from "node:path";
import { HIT_TYPES, withHitTypes } from "../src/combat/hitTypes.ts";
import type { StatesFile } from "../src/entity/states.ts";

/**
 * `npm run blows -- <entity>` — every blow the entity has, one row each, with
 * the numbers its hit type stands for spelled out beside its own damage.
 *
 * The overview the hit-type table used to give for free: since ADR 0019 a
 * blow's damage lives on its state, so comparing two blows means reading two
 * states — or this. Prints; writes nothing.
 */

const name = process.argv[2] ?? "goku";
const file = path.join("data", "entities", name, "states.json");
const states = withHitTypes(JSON.parse(readFileSync(file, "utf8")) as StatesFile).states;

const pad = (s: string | number | undefined, n: number): string => String(s ?? "—").padEnd(n);
console.log(pad("state", 18) + pad("anim", 16) + pad("type", 14) + pad("damage", 8) + pad("onHit", 14) + pad("hitstun", 9) + "hitstop");

for (const [state, def] of Object.entries(states)) {
  if (def.type === undefined && def.damage === undefined) continue;
  const type = def.type === undefined ? undefined : `${def.type} ${HIT_TYPES[def.type]?.code ?? "?"}`;
  console.log(
    pad(state, 18) + pad(def.anim, 16) + pad(type, 14) + pad(def.damage, 8) + pad(def.onHit, 14) + pad(def.hitstun, 9) + pad(def.hitstop, 0),
  );
}
