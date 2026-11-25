import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { generatedFighters } from "../rom/fighterStates";
import { chainLinks, type AnimSteps } from "./chains";
import { withHitTypes } from "./hitTypes";
import { SLOTS, withRush, type BlowAnim, type Picks } from "./rushSlots";

/**
 * The rush on every fighter's data as it stands (`combat.md`, The buttons). A
 * fighter has one only once the owner has accepted how it plays: Goku's and
 * Freeza's, on the original's three standing blows; everyone else's Attack is
 * one blow.
 */

const read = <T>(name: string, file: string): T => JSON.parse(readFileSync(`data/entities/${name}/${file}`, "utf8")) as T;

function fighter(name: string) {
  const states = withHitTypes(read<StatesFile>(name, "states.json"));
  const anims = read<Record<string, AnimSteps>>(name, "animations.json");
  const { hitstun } = read<{ hitstun: number }>(name, "attributes.json");
  return { states, links: chainLinks(states, anims, hitstun) };
}

/** Where each state of the rush goes, as `when>to`. */
const exits = (states: StatesFile, name: string): string[] =>
  (states.states[name]?.transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);

describe.each(generatedFighters())("%s's Attack and Smash", (name) => {
  const { states } = fighter(name);

  it("open from standing: Attack into rush_1, Smash into smash", () => {
    expect(exits(states, "idle")).toContain("pressed:attack>rush_1");
    expect(exits(states, "idle")).toContain("pressed:smash>smash");
  });
});

describe.each(["goku", "freeza"])("%s's rush", (name) => {
  const { links } = fighter(name);

  it("walks Attack rush_1 → rush_2 → rush_3 by cancels", () => {
    expect(links.map((l) => `${l.from}>${l.to}`).sort()).toEqual(["rush_1>rush_2", "rush_2>rush_3"]);
  });

  it("opens every link, and holds it: the latest press still lands inside the hitstun", () => {
    expect(links.filter((l) => l.opens > l.closes || !(l.margin >= 0))).toEqual([]);
  });
});

/** What each accepted rush holds, and how fast it steps — the rest is computed. */
const ACCEPTED: Record<string, { picks: Picks; step: { windup: number; hit: number } }> = {
  goku: { picks: ["m90", "m92", "m94"], step: { windup: 1.1875, hit: 0.625 } },
  freeza: { picks: ["m90", "m91", "m92"], step: { windup: 2.375, hit: 1.25 } },
};

describe.each(Object.keys(ACCEPTED))("%s's rush on disk", (name) => {
  it("is what withRush makes of its picks: the steps and the windows computed, none by hand", () => {
    const states = read<StatesFile>(name, "states.json");
    const anims = read<Record<string, BlowAnim>>(name, "animations.json");
    const { hitstun } = read<{ hitstun: number }>(name, "attributes.json");
    const { picks, step } = ACCEPTED[name];
    const made = withRush(states, anims, hitstun, picks, step);
    const slot = (f: StatesFile, s: string) => {
      const { anim, type, velAt, cancelBy, transitions } = f.states[s];
      return { anim, type, velAt, cancelBy, transitions };
    };
    for (const s of SLOTS) expect(slot(states, s), s).toEqual(slot(made, s));
  });
});

describe.each(generatedFighters().filter((n) => n !== "goku" && n !== "freeza"))("%s, whose rush is not accepted yet", (name) => {
  it("plays Attack as one blow", () => {
    expect(fighter(name).links.filter((l) => l.from.startsWith("rush_"))).toEqual([]);
  });
});
