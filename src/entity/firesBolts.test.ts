import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StateDef } from "./states";

const entities = readdirSync("data/entities").filter((name) => existsSync(`data/entities/${name}/states.json`));

/** What a state's `fires` puts out as a bolt: its `with` are drawn beside it, by the spawn's own animation. */
function boltsOf(def: StateDef): string[] {
  const fires = def.fires;
  return fires ? [fires.spawn, ...(fires.also ?? []).map((a) => a.spawn ?? fires.spawn)] : [];
}

describe("what a state fires", () => {
  it.each(entities)("%s fires only spawns with states: an effect as a bolt never ends, and hangs where it was put", (name) => {
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as { states: Record<string, StateDef> };
    const wrong = Object.entries(states).flatMap(([state, def]) =>
      boltsOf(def).filter((spawn) => !existsSync(`data/spawns/${spawn}/states.json`)).map((spawn) => `${state}: ${spawn}`),
    );
    expect(wrong).toEqual([]);
  });
});
