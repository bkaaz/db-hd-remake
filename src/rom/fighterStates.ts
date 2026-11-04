import { existsSync, readFileSync } from "node:fs";
import type { AnimInfo, StatesFile } from "../entity/states";
import { blowOfAnim } from "./animBlow";
import { readAttributes, withAttributes } from "./attributes";
import { CROUCH } from "./crouch";
import { GOKU, scriptAt, type FighterTables } from "./cartridge";
import { readCommands } from "./commands";
import { inTableOrder } from "./entries";
import { OWN_OBJECTS } from "./ownObjects";
import { ownMoves } from "./ownMoves";
import { fighterNamed, ROSTER, type FighterName } from "./roster";
import { holdStepOf, readScript } from "./script";
import { withSpecials, type SpecialsFile } from "./specials";
import { statesFrom, type Template } from "./template";
import { moveOf } from "./todo";

/**
 * A fighter's `states.json` as it should stand. The command that writes the
 * file and the test that calls it out of date both come here, so the two
 * cannot disagree about what "up to date" means.
 */

export interface FighterStates {
  file: StatesFile;
  /** What the template did to Goku's states on the way. */
  made: Template;
  /** His `specials.json`, if he has one. */
  own: SpecialsFile | null;
}

/**
 * His tables. He knows the shared objects (type a: sparks, bursts, dust) by
 * name, so a step that puts one out names it — the sparks of Vegeta's throw —
 * but none of Goku's own; and his own put out on a step by name: they cut no
 * part (Big Bang's flash).
 */
export function tablesOf(rom: Uint8Array, name: string): FighterTables {
  const stepped = (OWN_OBJECTS[name as FighterName] ?? []).flatMap((o) =>
    o.onStep ? [{ name: o.name, type: o.type, anim: o.anim, onStep: o.onStep, steps: [], loop: false, hits: false, palette: 0, loads: [] }] : [],
  );
  return fighterNamed(rom, name, { ...GOKU.objects, spawns: [...GOKU.objects.spawns.filter((sp) => sp.type === 0xa), ...stepped] });
}

/** Every fighter whose `states.json` is generated: all that have one but Goku, whose own is the template. */
export function generatedFighters(): FighterName[] {
  return ROSTER.filter((name) => name !== "goku" && existsSync(`data/entities/${name}/states.json`));
}

/** Move `1a`: a body knocked about in the air, tumbling to the jump's fall pose. */
export const AIR_REEL = 0x1a;

export function fighterStates(rom: Uint8Array, name: string, t: FighterTables): FighterStates {
  const animations = readJson<Record<string, unknown>>(`data/entities/${name}/animations.json`);
  const template = readJson<StatesFile>("data/entities/goku/states.json");
  // goku's own moves: what his command table picks, and what those go on to
  const specials = ownMoves(rom, GOKU);
  const made = statesFrom(template, {
    has: (a) => a in animations,
    special: (a) => specials.has(parseInt(a.slice(1, 3), 16)),
    foreign: (v) => v.startsWith("goku_"),
    blowOf: (a) => blowOfAnim(rom, t, a),
    // a shared object, from the b0 in his own script that puts it out
    spawnAt: (a, spawn) => {
      const def = GOKU.objects.spawns.find((sp) => sp.name === spawn);
      const move = moveOf(a);
      if (!def || move === null) return null;
      const op = readScript(rom, scriptAt(rom, t, move)).find((o) => o.op === "spawn" && o.type === def.type && o.anim === def.anim);
      return op && op.op === "spawn" ? [op.dx, op.dy] : null;
    },
  });
  // his own specials, by hand beside it, merged in so a run does not wipe them
  const specialsPath = `data/entities/${name}/specials.json`;
  const own = existsSync(specialsPath) ? readJson<SpecialsFile>(specialsPath) : null;
  // his own walk, dash and jump on the template's states ($3D:9D9B)
  const moved = withAttributes(made.file, readAttributes(rom, t.character));
  // his commands tried as the cartridge tries them, the table's last row first
  const file = inTableOrder(own ? withSpecials(moved, own) : moved, readCommands(rom, t.character));
  return { file: { ...file, states: blowsSaid(heldCrouch(heldTumble(file.states, rom, t), rom, t, animations), animations) }, made, own };
}

/** The air reel stops where his `1a` holds, on a step of its own in each fighter's script. */
function heldTumble(states: StatesFile["states"], rom: Uint8Array, t: FighterTables): StatesFile["states"] {
  const holdStep = holdStepOf(readScript(rom, scriptAt(rom, t, AIR_REEL)));
  return holdStep === null ? states : { ...states, reel_air: { ...states.reel_air, holdStep } };
}

/**
 * The crouch stops on the drawing `03` holds. Goku's script ends there; others
 * go on past it to a way back up nobody plays, the stand-up being `04`'s.
 */
function heldCrouch(states: StatesFile["states"], rom: Uint8Array, t: FighterTables, animations: Record<string, unknown>): StatesFile["states"] {
  const hold = readScript(rom, scriptAt(rom, t, CROUCH)).find((op) => op.op === "hold");
  const steps = (animations[states.crouch.anim ?? ""] as { steps: { frame: string }[] } | undefined)?.steps ?? [];
  if (hold?.op !== "hold" || hold.drawing === null) return states;
  const holdStep = steps.findIndex((s) => s.frame === String(hold.drawing));
  return holdStep < 0 || holdStep === steps.length - 1 ? states : { ...states, crouch: { ...states.crouch, holdStep } };
}

/**
 * A drawing may carry a hit box in a state that names no blow: a part of a
 * move whose reaction no type copies, or a pose reused in a reaction. The game
 * asks such a state to say 0 for itself (`validateStates`), and that is all
 * this says: ours hit with what `attackDamage` makes of nothing anyway.
 */
function blowsSaid(states: StatesFile["states"], animations: Record<string, unknown>): StatesFile["states"] {
  const strikes = (anim: string | undefined) =>
    ((animations[anim ?? ""] as AnimInfo | undefined)?.steps ?? []).some((s) => s.boxes?.some((b) => b.type === "hit"));
  return Object.fromEntries(
    Object.entries(states).map(([name, def]) => [name, def.type === undefined && def.damage === undefined && strikes(def.anim) ? { ...def, damage: 0 } : def]),
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
