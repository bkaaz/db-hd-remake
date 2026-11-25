import type { StatesFile } from "../entity/states";
import { CLOSE, ENDERS, RUSH, SLOTS, type Pick, type Picks, type Slot } from "./rushSlots";

/**
 * A rush's picks as people and addresses spell them: `A1`–`A4` for Attack's
 * line, `A1c` for A1 thrown close, `S1`–`S3` for Smash off each depth —
 * `A1=m90,A1c=b_knee,A2=m92,S1=m93:knockback`
 * in the scene's address, a line of the same words to hand over.
 */

/** `A1` for rush_1, `A1c` for its close one, `S2` for smash_2. */
export function labelOf(slot: Slot): string {
  if (slot === CLOSE) return "A1c";
  const at = RUSH.indexOf(slot as (typeof RUSH)[number]);
  return at >= 0 ? `A${at + 1}` : `S${ENDERS.indexOf(slot as (typeof ENDERS)[number]) + 1}`;
}

const SLOT_OF = new Map(SLOTS.map((s) => [labelOf(s), s]));

/** What the rush in `file` plays now — rush_1, A1c if a way leads in, each slot a cancel leads to — and how each is taken there. */
export function picksOf(file: StatesFile): Picks {
  const picks: Picks = {};
  const into = Object.values(file.states).some((d) => (d.transitions ?? []).some((t) => t.to === CLOSE));
  const reached = new Set<string>(["rush_1", ...(into ? [CLOSE] : [])]);
  for (const slot of SLOTS) {
    const def = file.states[slot];
    if (!def || !reached.has(slot)) continue;
    picks[slot] = { anim: def.anim, ...(def.type !== undefined && { type: def.type }) };
    for (const t of def.transitions ?? []) if ([t.when].flat().includes("cancelable")) reached.add(t.to);
  }
  return picks;
}

/** The picks as the address carries them. */
export function writePicks(picks: Picks): string {
  return SLOTS.filter((s) => picks[s])
    .map((s) => `${labelOf(s)}=${picks[s]!.anim}${picks[s]!.type ? `:${picks[s]!.type}` : ""}`)
    .join(",");
}

/** `A1=m90,S1=m93:knockback` read back, against his animations and the hit types — or why not. */
export function readPicks(text: string, anims: Record<string, unknown>, types: Record<string, unknown>): Picks | string {
  const picks: Picks = {};
  for (const part of text.split(",")) {
    const [label, what = ""] = part.split("=");
    const [anim, type] = what.split(":");
    const slot = SLOT_OF.get(label);
    if (!slot) return `rush: no slot "${label}" — A1–A4, S1–S3`;
    if (!(anim in anims)) return `rush: no animation ${anim}`;
    if (type !== undefined && !(type in types)) return `rush: no hit type ${type}`;
    picks[slot] = { anim, ...(type !== undefined && { type }) } satisfies Pick;
  }
  return picks;
}

/** The line the panel offers to copy, naming what each slot holds. */
export function picksLine(fighter: string, picks: Picks): string {
  const said = SLOTS.filter((s) => picks[s]).map((s) => `${labelOf(s)} ${picks[s]!.anim}${picks[s]!.type ? ` ${picks[s]!.type}` : ""}`);
  return `${fighter}: ${said.join(", ")}`;
}
