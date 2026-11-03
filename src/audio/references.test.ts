import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every sound the committed data names is in the bank or in the fighter's own
 * `sounds.json`. Playback is silent on an unknown name by design, so a rename
 * that misses one field is heard by nobody — this is where it is caught.
 */

const root = fileURLToPath(new URL("../../data/", import.meta.url));
const json = (path: string): unknown => JSON.parse(readFileSync(root + path, "utf8"));
const keys = (path: string): Set<string> =>
  existsSync(root + path) ? new Set(Object.keys(json(path) as object)) : new Set();

/** Every string under a key that names a sound (`sound`, `hitSound`, `loopSound`, `sounds`…), however nested. */
export function soundNames(value: unknown, underSound = false): string[] {
  if (typeof value === "string") return underSound ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => soundNames(v, underSound));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => soundNames(v, underSound || /sound/i.test(k)));
  return [];
}

describe("soundNames", () => {
  it("finds a name in every shape a state names one", () => {
    const state = {
      sound: ["line_00", "charge_25"],
      hitSound: "hit_09",
      loopSound: "charge_19",
      anim: "m3b",
      fires: { sounds: { thrown: "blast_0b" } },
    };
    expect(soundNames(state).sort()).toEqual(["blast_0b", "charge_19", "charge_25", "hit_09", "line_00"]);
  });
});

describe("the data's sound names", () => {
  const bank = keys("audio/sounds.json");
  const fighters = readdirSync(root + "entities");
  const voices = new Set(fighters.flatMap((f) => [...keys(`entities/${f}/sounds.json`)]));

  for (const f of fighters) {
    it(`${f}'s states name only sounds the bank or his own file has`, () => {
      const own = keys(`entities/${f}/sounds.json`);
      const named = ["states.json", "specials.json"]
        .filter((file) => existsSync(root + `entities/${f}/${file}`))
        .flatMap((file) => soundNames(json(`entities/${f}/${file}`)));
      expect(named.filter((n) => !bank.has(n) && !own.has(n))).toEqual([]);
    });
  }

  // a spawn plays on its thrower's side, so a fighter's voice is fair
  it("the spawns name only sounds the bank or a fighter has", () => {
    const named = readdirSync(root + "spawns")
      .filter((s) => existsSync(root + `spawns/${s}/states.json`))
      .flatMap((s) => soundNames(json(`spawns/${s}/states.json`)).map((n) => `${s}: ${n}`));
    expect(named.filter((n) => !bank.has(n.split(": ")[1]) && !voices.has(n.split(": ")[1]))).toEqual([]);
  });
});
