import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { generatedFighters } from "../rom/fighterStates";
import { chainLinks, type AnimSteps } from "./chains";
import { withHitTypes } from "./hitTypes";
import { aimed } from "./rushEntries";
import { AIMS, CLOSE, DEFAULT_STEP, ENDERS, RUSH, SLOTS, withRush, type BlowAnim, type RushFile } from "./rushSlots";
import { withCharge } from "./smashCharge";

/**
 * The rush on every fighter's data as it stands (`combat.md`, The buttons):
 * each made by `npm run states` of his `rush.json`. What the owner has
 * accepted of it plays as a combo; the rest is a placeholder to pick over.
 */

const read = <T>(name: string, file: string): T => JSON.parse(readFileSync(`data/entities/${name}/${file}`, "utf8")) as T;

function fighter(name: string) {
  const states = withHitTypes(read<StatesFile>(name, "states.json"));
  const anims = read<Record<string, AnimSteps>>(name, "animations.json");
  const { hitstun } = read<{ hitstun: number }>(name, "attributes.json");
  // the rush's own links, slot to slot: a special off one of them is out of it
  const links = chainLinks(states, anims, hitstun).filter((l) => (SLOTS as readonly string[]).includes(l.from) && (SLOTS as readonly string[]).includes(l.to));
  return { states, links, rush: read<RushFile>(name, "rush.json") };
}

/** Where a state goes, as `when>to`. */
const exits = (states: StatesFile, name: string): string[] =>
  (states.states[name]?.transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);

/** A depth's own ways on: Attack down the line, and before A4 each ender a direction asks for (owner, 2026-11-26). */
function ownWay(from: string, to: string): boolean {
  const depth = from === CLOSE ? 0 : RUSH.indexOf(from as (typeof RUSH)[number]);
  return to === RUSH[depth + 1] || (depth < ENDERS.length && (ENDERS as readonly string[]).includes(to));
}

/** The links the owner has accepted as combos (2026-11-25): Goku's own ways on, Freeza's Attack line. */
const ACCEPTED: Record<string, (from: string, to: string) => boolean> = {
  goku: ownWay,
  freeza: (from, to) => ownWay(from, to) && to.startsWith("rush_"),
};

describe.each(generatedFighters())("%s's rush", (name) => {
  const { states, links, rush } = fighter(name);

  it("opens from standing: Attack into rush_1, Smash into smash, a direction + Smash into its ender", () => {
    const smash = ENDERS.map((e) => `${aimed(AIMS[e]).join("+")}>${e}`);
    expect(exits(states, "idle")).toEqual(expect.arrayContaining(["pressed:attack>rush_1", ...smash, "pressed:smash>smash"]));
    const idle = exits(states, "idle");
    for (const s of smash) expect(idle.indexOf(s)).toBeLessThan(idle.indexOf("pressed:smash>smash"));
  });

  it("takes down + Smash crouching into S3, ahead of the crouching blow", () => {
    const crouch = exits(states, "crouch");
    expect(crouch.indexOf(`${aimed("down").join("+")}>smash_3`)).toBeLessThan(crouch.indexOf("pressed:smash>crouch_b"));
  });

  it("leaves every depth on Smash for the ender a direction asks for, any of them", () => {
    const line = RUSH.filter((_, i) => RUSH.slice(0, i + 1).every((r) => rush.picks[r]));
    for (const slot of line) expect(new Set(links.filter((l) => l.from === slot && l.on === "smash").map((l) => l.to))).toEqual(new Set(ENDERS));
  });

  it("is what withRush and withCharge make of his rush.json, made again: nothing of it by hand", () => {
    const anims = read<Record<string, BlowAnim>>(name, "animations.json");
    const { hitstun } = read<{ hitstun: number }>(name, "attributes.json");
    const disk = read<StatesFile>(name, "states.json");
    const rushed = withRush(disk, anims, hitstun, rush.picks, rush.step ?? DEFAULT_STEP);
    expect((rush.charge ?? []).reduce((f, ender) => withCharge(f, anims, ender), rushed)).toEqual(disk);
  });

  it("plays what the owner accepted as a combo: the latest press still lands inside the hitstun", () => {
    const accepted = ACCEPTED[name] ?? (() => false);
    expect(links.filter((l) => accepted(l.from, l.to) && (l.opens > l.closes || !(l.margin >= 0)))).toEqual([]);
  });
});
