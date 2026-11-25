import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { generatedFighters } from "../rom/fighterStates";
import { chainLinks, type AnimSteps } from "./chains";
import { withHitTypes } from "./hitTypes";
import { ENDERS, RUSH, SLOTS, withRush, type BlowAnim, type Picks } from "./rushSlots";

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

/** What each accepted rush holds, and how fast it steps — the rest is computed. */
const ACCEPTED: Record<string, { picks: Picks; step: { windup: number; hit: number } }> = {
  // the owner's, 2026-11-25: the Quad Kick's four kicks, an ender of the ultimate's at each depth
  goku: {
    picks: {
      rush_1: { anim: "b_qk1", type: "flinch" },
      rush_2: { anim: "b_qk2", type: "flinch" },
      rush_3: { anim: "b_qk3", type: "flinch" },
      rush_4: { anim: "b_qk4", type: "heavy" },
      smash_1: { anim: "b_116", type: "stagger" },
      smash_2: { anim: "b_110", type: "down" },
      smash_3: { anim: "b_80", type: "high" },
    },
    step: { windup: 1.1875, hit: 0.625 },
  },
  freeza: { picks: { rush_1: { anim: "m90" }, rush_2: { anim: "m91" }, rush_3: { anim: "m92" } }, step: { windup: 2.375, hit: 1.25 } },
};

describe.each(Object.keys(ACCEPTED))("%s's rush", (name) => {
  const { links } = fighter(name);
  const { picks } = ACCEPTED[name];

  it("walks Attack down the line it picked, and leaves it on Smash where an ender is picked", () => {
    const line = RUSH.filter((_, i) => RUSH.slice(0, i + 1).every((r) => picks[r]));
    const walks = line.slice(1).map((s, i) => `${line[i]}>${s}`);
    const ends = ENDERS.filter((e, i) => picks[e] && line[i]).map((e) => `${RUSH[ENDERS.indexOf(e)]}>${e}`);
    expect(links.map((l) => `${l.from}>${l.to}`).sort()).toEqual([...walks, ...ends].sort());
  });

  it("opens every link, and holds it: the latest press still lands inside the hitstun", () => {
    expect(links.filter((l) => l.opens > l.closes || !(l.margin >= 0))).toEqual([]);
  });
});

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
    for (const s of SLOTS.filter((s) => ACCEPTED[name].picks[s])) expect(slot(states, s), s).toEqual(slot(made, s));
  });
});

describe.each(generatedFighters().filter((n) => n !== "goku" && n !== "freeza"))("%s, whose rush is not accepted yet", (name) => {
  it("plays Attack as one blow", () => {
    expect(fighter(name).links.filter((l) => l.from.startsWith("rush_"))).toEqual([]);
  });
});
