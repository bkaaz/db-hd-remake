import { blowStarts, jumpCuts, moveAnims, stepStarts } from "./animation";
import { NORMALS } from "./buttons";
import { scriptAt, type FighterTables } from "./cartridge";
import { readBoxes } from "./collision";
import { arrow, buttonName, readCommands } from "./commands";
import { commandContext, describeConditions } from "./conditions";
import { describeFact, factParts } from "./describe";
import { handlerAt, handlerFacts, type HandlerFact } from "./handler";
import { holdOffsets } from "./hold";
import { ROSTER } from "./roster";
import { groundReaction, hitRecords, objectRecord, recordAt, type HitRecord } from "./hits";
import { readScript } from "./script";

/**
 * Everything the cartridge says about one move, laid out per part of its
 * animation — the part a state plays — so the states can be written from it
 * without reading the code again (`npm run rom -- port a5`). Frames inside a
 * part count from the part's start, as a state's own frames do.
 */
export interface PortReport {
  move: number;
  /** How a player asks for it: a button, or a command's directions and button. */
  inputs: string[];
  /**
   * What the handler does on no one frame it compares with: under a bound
   * ("from frame 52"), a routine's answer ("when its object 0a/15 is gone"),
   * every frame, or once the script has run out (frame 0).
   */
  anyFrame: HandlerFact[];
  /** Where the handler holds an opponent (`$0D:DE9A`), by the opponent's character: (dx, dy) per step of the move's script. */
  holds: { against: string; at: [number, number][] }[];
  /** For each command that picks it: what it needs, what it costs, what it does to the opponent. */
  commands: { needs: string[]; cost: number; opponentMove: number | null }[];
  handler: number;
  parts: PartReport[];
}

export interface PartReport {
  anim: string;
  /** The move's frame this part starts on, and how many it lasts. */
  from: number;
  frames: number;
  /** The blow whose hit box rises in this part, if one does. */
  blow?: { frame: number; type: string; damage: number; stun: number };
  /** What the script plays, and what the handler plays (`handler: true`) — the opponent's voice, `opponent: true`. */
  sounds: { frame: number; id: number; handler?: true; opponent?: true }[];
  /** Objects started, with what their blow does (`$3D:9624`). */
  spawns: { frame: number; counter: number; type: number; anim: number; blow: { type: string; damage: number; stun: number } }[];
  /** What the handler does here: the speed carried in, and the frames it changes. */
  vel: number;
  velAt: [number, number][];
  rearms: number[];
  /** Anything else the handler does on one frame of this part. */
  onFrames: { frame: number; what: string }[];
  /**
   * What a handler that runs by step does on the steps of this part, under
   * the conditions `handler.ts` reads (a landing); one it cannot read (vy
   * turning) leaves the fact bare — the address is in the report.
   */
  onSteps: { step: number; under: string; what: string }[];
}

export function portReport(rom: Uint8Array, t: FighterTables, move: number): PortReport {
  const ops = readScript(rom, scriptAt(rom, t, move));
  const boxesOf = (d: number) => readBoxes(rom, t.boxes, d);
  const records = hitRecords(rom, t.character, move);
  const handler = handlerAt(rom, t.character, move);
  const facts = handlerFacts(rom, handler, stepStarts(ops).length, t.character);
  const anims = moveAnims(move, ops, boxesOf, jumpCuts(ops, facts));

  // the move's frame each step and each command falls on
  const stepFrame: number[] = [];
  const events: { frame: number; op: (typeof ops)[number] }[] = [];
  let frame = 0;
  for (const op of ops) {
    events.push({ frame, op });
    if (op.op === "show" || op.op === "hold") {
      stepFrame.push(frame);
      frame += op.op === "hold" ? 1 : op.frames;
    }
  }
  const blows = blowStarts(ops, boxesOf).map((step) => ({ step, frame: stepFrame[step] }));
  const stepped = facts.filter((f): f is HandlerFact & { step: number } => f.step !== undefined);

  const parts: PartReport[] = [];
  let from = 0;
  for (const [anim, { steps }] of Object.entries(anims)) {
    const frames = steps.reduce((n, s) => n + (s.dur ?? 0), 0);
    const inside = (f: number) => f >= from && f < from + frames;
    const blow = blows.find((b) => inside(b.frame));
    const record = blow && recordAt(records, blow.step);
    const speeds = facts.filter((f) => f.vx !== undefined && f.frame !== null) as { frame: number; vx: number }[];
    parts.push({
      anim,
      from,
      frames,
      blow: blow && record && {
        frame: blow.frame - from,
        type: groundReaction(record),
        damage: record.damage,
        stun: record.stun,
      },
      sounds: [
        ...events.flatMap((e) => (e.op.op === "sound" && inside(e.frame) ? [{ frame: e.frame - from, id: e.op.id }] : [])),
        ...facts.flatMap((f) =>
          f.sound !== undefined && f.frame !== null && inside(f.frame)
            ? [{ frame: f.frame - from, id: f.sound, handler: true as const, ...(f.who === "opponent" && { opponent: true as const }) }]
            : [],
        ),
      ],
      spawns: events.flatMap((e) =>
        e.op.op === "spawn" && inside(e.frame)
          ? [{ frame: e.frame - from, counter: e.op.counter, type: e.op.type, anim: e.op.anim, blow: blowOf(objectRecord(rom, e.op.type, e.op.anim)) }]
          : [],
      ),
      vel: speeds.filter((s) => s.frame < from).at(-1)?.vx ?? 0,
      velAt: speeds.filter((s) => inside(s.frame)).map((s) => [s.frame - from, s.vx]),
      rearms: facts.filter((f) => f.what === "re-arms the blow" && f.frame !== null && inside(f.frame)).map((f) => f.frame! - from),
      onFrames: facts
        .filter((f) => f.frame && f.step === undefined && inside(f.frame) && !SHOWN.has(f.what))
        .map((f) => ({ frame: f.frame! - from, what: describeFact(f) })),
      onSteps: stepped.filter((f) => inside(stepFrame[f.step])).map((f) => ({ step: f.step, ...factParts(f) })),
    });
    from += frames;
  }

  const commands = readCommands(rom, t.character).filter((c) => c.move === move);
  const inputs = [
    ...(NORMALS[move] ? [NORMALS[move]] : []),
    ...commands.map((c) => `${c.where}: ${[...c.directions.map(arrow), buttonName(c.button)].join(" ")}`),
  ];
  const context = commandContext(rom, t.character);
  return {
    move,
    inputs,
    commands: commands.map((c) => ({ needs: describeConditions(c.conditions, context), cost: c.cost, opponentMove: c.opponentMove })),
    anyFrame: facts.filter((f) => !f.frame && f.step === undefined),
    holds: [...new Set(facts.flatMap((f) => (f.hold === undefined ? [] : [f.hold])))].flatMap((table) =>
      ROSTER.map((against, c) => ({ against, at: holdOffsets(rom, table, c, stepStarts(ops).length) })),
    ),
    handler,
    parts,
  };
}

/** What a part already lists on its own line. */
const SHOWN = new Set(["plays sound", "sets vx", "re-arms the blow"]);

function blowOf(r: HitRecord): { type: string; damage: number; stun: number } {
  return { type: groundReaction(r), damage: r.damage, stun: r.stun };
}
