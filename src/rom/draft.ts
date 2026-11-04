import type { StateDef, Transition } from "../entity/states";
import { commandContext, describeConditions } from "./conditions";
import type { FighterTables } from "./cartridge";
import { readCommands } from "./commands";
import { grabOf } from "./grab";
import type { HandlerFact } from "./handler";
import { moveParts } from "./parts";
import { portReport, type PartReport, type PortReport } from "./port";
import type { ScriptOp } from "./script";
import type { SpecialsFile } from "./specials";

/**
 * A first `specials.json` from the reports: what `port` says of each command's
 * move, as states — its parts in a chain, each part's blow, speeds and jumps,
 * its cost and where it is asked for. A skeleton to correct, not a port: what
 * a handler decides (a charge's levels, a counter, a hit told from a block)
 * stays behind, and each such gap is in `notes` for `port-review.md`.
 */

export interface Draft {
  specials: SpecialsFile;
  /** Every object the moves put out, with the move that does. */
  objects: { move: number; spawn: PartReport["spawns"][number] }[];
  /** One line per move: the state it starts in, its input, and what it left out. */
  moves: { move: string; state: string; input: string; left: string[] }[];
}

/** What every state a command is read from, on the ground and in a jump (`$0F:9EB1`). */
const GROUND = ["idle", "walk_fwd", "walk_back", "crouch_down", "crouch", "stand_up"];
const JUMPS = ["jump_up", "jump_fwd", "jump_back"];
const HIT = { hitSound: "hit_09", blockSound: "block_17" };
/** A move below this is the game's own, not one more part of a special: landing, falling, a reaction. */
const FIRST_SPECIAL = 0x90;
const LAND = 0x3b;
const FALL = 0x05;
const CROUCH = 0x03;
/** Bit 7 of field 0x25 clear: its blow has connected ($2A:8190). */
const CONNECTED = /field 25 .* has none of 80/;

const hex = (n: number) => n.toString(16).padStart(2, "0");

export function draftSpecials(
  rom: Uint8Array,
  t: FighterTables,
  names: Record<string, string>,
  spawnOf: (type: number, anim: number) => string,
  knownType: (type: string) => boolean,
  /** Normals the template's state cannot play as they are his, by id, with that state's name: drafted in its place. */
  normals: Record<string, string> = {},
  /** Which of those are a jump's: they go on at the jump's speed. */
  jumping: readonly string[] = [],
): Draft {
  const commands = readCommands(rom, t.character).filter((c) => c.where !== "mode");
  const base = (move: number) => normals[hex(move)] ?? names[hex(move)] ?? `move_${hex(move)}`;
  const queue = [...new Set([...commands.map((c) => c.move), ...Object.keys(normals).map((m) => parseInt(m, 16))])];
  const states: Record<string, StateDef> = {};
  const moves: Draft["moves"] = [];
  const objects: Draft["objects"] = [];
  const entries: SpecialsFile["entries"] = [];
  const chains: { from: number; move: number; connected: boolean }[] = [];
  const context = commandContext(rom, t.character);

  for (let i = 0; i < queue.length; i++) {
    const move = queue[i];
    const report = portReport(rom, t, move);
    const { facts, ops } = moveParts(rom, t, move);
    const after = (m: number) => {
      if (m >= FIRST_SPECIAL && !queue.includes(m)) queue.push(m);
      if (m === CROUCH) return "crouch";
      return m === LAND ? "land" : m === FALL ? "jump_fall_attacked" : m >= FIRST_SPECIAL ? base(m) : "idle";
    };
    const left: string[] = [];
    const written = statesOf(report, facts, ops, base(move), after, spawnOf, knownType, left, objects, jumping.includes(hex(move)));
    Object.assign(states, written);

    const command = commands.find((c) => c.move === move);
    if (!command) {
      moves.push({ move: hex(move), state: base(move), input: hex(move) in normals ? "his own normal" : "from another move", left });
      continue;
    }
    moves.push({ move: hex(move), state: base(move), input: report.inputs.join(" | "), left });
    const needs = describeConditions(command.conditions, context);
    const after_ = needs.flatMap((n) => [.../in one of its moves ([0-9a-f ,]+)/.exec(n)?.[1].split(/[ ,]+/) ?? []]);
    if (after_.length > 0) {
      const connected = needs.some((n) => /done/.test(n));
      for (const m of new Set(after_)) chains.push({ from: parseInt(m, 16), move, connected });
      continue;
    }
    const health = needs.map((n) => /health (\d+) or less/.exec(n)?.[1]).find(Boolean);
    const within = needs.map((n) => /within (\d+) px/.exec(n)?.[1]).find(Boolean);
    const when = [`command:${hex(move)}`];
    if (health) when.push(`health:${health}`);
    if (within) when.unshift(command.opponentMove !== null && Number(within) === context.grab ? "grab" : `grab:${within}`);
    const asked = when.length === 1 ? when[0] : when;
    if (command.where === "ground") entries.push({ from: GROUND, when: asked, to: base(move) });
    else {
      entries.push({ from: JUMPS, when: ["frames:2", ...when], to: base(move) });
      entries.push({ from: ["jump_fall"], when: asked, to: base(move) });
    }
  }

  // a move only another's blow leads to: asked for from that move's own states
  for (const { from, move, connected } of chains) {
    const way: Transition = { when: connected ? ["connected", `command:${hex(move)}`] : `command:${hex(move)}`, to: base(move) };
    for (const [name, state] of Object.entries(states)) {
      if (name === base(from) || name.startsWith(`${base(from)}_`)) state.transitions = [way, ...(state.transitions ?? [])];
    }
  }
  return { specials: { replaces: Object.values(normals), entries, states }, objects, moves };
}

/** One state per part of the move. */
function statesOf(
  report: PortReport,
  facts: HandlerFact[],
  ops: ScriptOp[],
  name: string,
  after: (move: number) => string,
  spawnOf: (type: number, anim: number) => string,
  knownType: (type: string) => boolean,
  left: string[],
  objects: Draft["objects"],
  inAJump: boolean,
): Record<string, StateDef> {
  const out: Record<string, StateDef> = {};
  const nameOf = (part: number) => (part === 0 ? name : `${name}_${part + 1}`);
  const plain = facts.filter((f) => !f.who && !(f.when?.length));
  // the last of what a landing sets: a step's own landing goes on from 3b into another move (Gotenks's a8, aa)
  const landing = facts.filter((f) => f.move !== undefined && !f.who && f.when?.some((w) => /landed/.test(w))).at(-1);
  // frame 0 again is the script run out: it wraps ($01:85FD)
  const ended = facts.find((f) => f.move !== undefined && !f.who && f.frame === 0 && !f.when?.some((w) => /landed/.test(w)));
  const hit = facts.find((f) => f.move !== undefined && !f.who && f.when?.some((w) => CONNECTED.test(w)) && !f.when?.some((w) => /field 40/.test(w)));
  const held = ops[ops.length - 1]?.op === "hold" || ops.some((o) => o.op === "hold");
  const hangs = report.inputs.some((i) => i.startsWith("air:"));
  let aloft = hangs || inAJump;
  let gravityOff = false;

  report.parts.forEach((part, i) => {
    const last = i === report.parts.length - 1;
    const wasAloft = aloft;
    const inPart = (f: HandlerFact) => f.frame !== null && f.frame >= part.from && f.frame < part.from + part.frames;
    const events = new Map<number, Record<string, unknown>>();
    const at = (frame: number) => events.get(frame) ?? (events.set(frame, {}), events.get(frame)!);
    for (const f of plain.filter(inPart)) {
      const frame = f.frame! - part.from;
      if (/gravity off/.test(f.what)) ((gravityOff = true), (at(frame).gravity = 0));
      else if (/gravity on/.test(f.what)) ((gravityOff = false), (at(frame).gravity = "own"));
      if (f.vy !== undefined) {
        at(frame).vy = f.vy;
        if (!gravityOff) at(frame).gravity = "own";
        aloft = true;
      }
    }
    const state: Record<string, unknown> = { anim: part.anim, turn: false };
    if (aloft || wasAloft) {
      for (const [frame, vx] of part.velAt) at(frame).vx = vx;
      if (i === 0 && hangs) Object.assign(at(0), { vx: 0, vy: 0, gravity: 0, ...events.get(0) });
      if (wasAloft) state.airborne = true;
      else state.vel = [part.vel, 0];
      if (events.size > 0) state.air = [...events].sort(([a], [b]) => a - b);
    } else {
      state.vel = [part.vel, 0];
      if (part.velAt.length > 0) state.velAt = [...new Map(part.velAt).entries()];
    }
    if (part.unhittable[0]?.frame === 0 && part.unhittable[0].on) state.invulnerable = true;
    if (i === 0 && report.commands[0]?.cost) state.healthCost = report.commands[0].cost;
    if (part.blow && knownType(part.blow.type)) Object.assign(state, HIT, { type: part.blow.type, damage: part.blow.damage });
    else if (part.blow && part.blow.type === "other") left.push(`${part.anim}'s blow, a reaction no type copies`);
    if (report.launch && i === 0) state.grab = grabOf(report, "reel_down");

    // the counter steps as each fires: what follows on the same frame comes out with it (a beam's head and base)
    const shots = part.spawns.filter((s, n) => s.frame === part.spawns[0].frame && s.counter === part.spawns[0].counter + n);
    const placed = shots.flatMap((s) => {
      objects.push({ move: report.move, spawn: s });
      const op = ops.find((o) => o.op === "spawn" && o.type === s.type && o.anim === s.anim);
      return op?.op === "spawn" ? [{ spawn: spawnOf(s.type, s.anim), at: [op.dx, op.dy] as [number, number] }] : [];
    });
    if (placed[0]) {
      const [first, ...rest] = placed;
      state.fires = { spawn: first.spawn, at: first.at, state: "fly", ...(rest.length && { with: rest.map(({ spawn, at: a }) => ({ spawn, at: a })) }) };
    }
    if (part.spawns.length > shots.length) left.push(`${part.anim}: only the first of its spawn counters`);

    const ways: Transition[] = [];
    if (hit) ways.push({ when: "connected", to: after(hit.move!) });
    if (aloft) ways.push({ when: "landed", to: landing ? after(landing.move!) : "land" });
    if (!last) ways.push({ when: "animEnd", to: nameOf(i + 1) });
    else if (aloft && held) state.holdStep = Math.max(0, stepsIn(part, ops) - 1);
    else ways.push({ when: "animEnd", to: ended ? after(ended.move!) : aloft ? "jump_fall_attacked" : "idle" });
    state.transitions = ways;
    out[nameOf(i)] = state as unknown as StateDef;
  });
  if (facts.some((f) => f.when?.some((w) => /held|field f0/.test(w)))) left.push("what its handler decides on a button held or a level `?`");
  return out;
}

/** The steps of the script shown in this part, a hold among them. */
function stepsIn(part: PartReport, ops: ScriptOp[]): number {
  let at = 0;
  let steps = 0;
  for (const op of ops) {
    if (op.op !== "show" && op.op !== "hold") continue;
    if (at >= part.from && at < part.from + part.frames + 1) steps++;
    at += op.op === "show" ? op.frames : 0;
  }
  return steps;
}
