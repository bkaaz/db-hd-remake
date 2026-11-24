import { existsSync, readFileSync } from "node:fs";
import type { StatesFile } from "../entity/states";
import { blowOfAnim } from "./animBlow";
import type { FighterTables } from "./cartridge";
import { missingEntries } from "./entries";
import { hitFields, objectHit } from "./objectHit";
import { portReport } from "./port";

/**
 * Where a fighter's states and objects part from what the cartridge says, a
 * line each, for `npm run rom -- states`. These were tests while the port
 * copied the cartridge; once a number may differ on purpose, a difference is
 * something to look at, not a failure.
 */

/** Where the cartridge reads his commands, standing, walking or crouching (`$0F:9EB1`). */
const NEUTRAL = ["idle", "walk_fwd", "walk_back", "crouch_down", "crouch", "crouch_loop", "stand_up"];

export function cartridgeLines(rom: Uint8Array, t: FighterTables, name: string, states: StatesFile["states"]): string[] {
  return [...blowLines(rom, t, states), ...partLines(rom, t, states), ...entryLines(rom, t, states), ...objectLines(rom, name)];
}

/** Every blow against the cartridge's for the move part it plays: its type and damage. */
function blowLines(rom: Uint8Array, t: FighterTables, states: StatesFile["states"]): string[] {
  return Object.entries(states).flatMap(([name, def]) => {
    if (def.type === undefined) return [];
    const blow = blowOfAnim(rom, t, def.anim ?? "");
    if (!blow) return [`${name}: a blow, where the cartridge's ${def.anim} has none`];
    // a blow that catches: the hold takes him at once, its type only a hitstop (ADR 0035)
    const ours = `${def.catches ? blow.type : def.type} ${def.damage}`;
    return ours === `${blow.type} ${blow.damage}` ? [] : [`${name}: cartridge ${blow.type} ${blow.damage}, ours ${ours}`];
  });
}

/** Where blows and bodies pass him (field `0x96`) against `invulnerable` and `pushless`, part by part. */
function partLines(rom: Uint8Array, t: FighterTables, states: StatesFile["states"]): string[] {
  const moves = new Set(Object.values(states).flatMap((d) => (/^m([0-9a-f]{2})(_\d+)?$/.exec(d.anim) ? [parseInt(d.anim.slice(1, 3), 16)] : [])));
  const lines: string[] = [];
  for (const move of moves) {
    let on = false;
    let pass = false;
    for (const part of portReport(rom, t, move).parts) {
      // a part takes what holds at its start; the field is set on a part's first frame
      const start = part.unhittable.find((u) => u.frame === 0);
      on = start?.on ?? on;
      pass = start?.pass ?? pass;
      for (const [name, def] of Object.entries(states).filter(([, d]) => d.anim === part.anim)) {
        if ((move >= 0x90 || move === 0x1b) && !!def.invulnerable !== on) lines.push(`${name}.invulnerable: cartridge ${on}, ours ${!!def.invulnerable}`);
        if (!!def.pushless !== pass) lines.push(`${name}.pushless: cartridge ${pass}, ours ${!!def.pushless}`);
      }
    }
  }
  return lines;
}

/** Commands the cartridge reads in a neutral state that has no entry for them. */
function entryLines(rom: Uint8Array, t: FighterTables, states: StatesFile["states"]): string[] {
  return missingEntries(rom, t, { initial: "idle", states })
    .filter((m) => NEUTRAL.includes(m.state))
    .map((m) => `${m.state}: no entry for ${m.moves.map((move) => move.toString(16)).join(", ")}, which the cartridge reads there`);
}

/** Each of his objects' blows against how the cartridge's answers a hit: burning, the flash, what it bursts into. */
function objectLines(rom: Uint8Array, fighter: string): string[] {
  const path = `data/entities/${fighter}/objects.json`;
  if (!existsSync(path)) return [];
  const objects = JSON.parse(readFileSync(path, "utf8")) as { name: string; type: number; anim: number }[];
  return objects.flatMap(({ name, type, anim }) => {
    const states = `data/spawns/${name}/states.json`;
    if (!existsSync(states)) return [];
    const blows = Object.values(JSON.parse(readFileSync(states, "utf8")).states as Record<string, Record<string, unknown>>).filter((s) => s.type);
    if (blows.length === 0) return [];
    const hit = objectHit(rom, type, anim);
    const fields = hit.stays ? null : hitFields(hit).state;
    const lines: string[] = [];
    if (blows.some((b) => !!b.burns !== (!hit.stays && hit.burns) || b.hitFlash !== fields?.hitFlash)) lines.push(`${name}: burns or flashes otherwise than the cartridge's`);
    const right = hit.stays ? blows[0].outlivesHit === true : blows[0].burstsInto === fields?.burstsInto;
    if (!right) lines.push(`${name}: answers a hit otherwise than the cartridge's (${hit.stays ? "it stays" : `bursts into ${fields?.burstsInto}`})`);
    return lines;
  });
}
