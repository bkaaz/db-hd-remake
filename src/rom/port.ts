import { blowStarts, jumpCuts, moveAnims, stepStarts } from "./animation";
import { NORMALS } from "./buttons";
import { scriptAt, type FighterTables } from "./cartridge";
import { readBoxes } from "./collision";
import { arrow, buttonName, readCommands } from "./commands";
import { commandContext, describeConditions } from "./conditions";
import { handlerAt, handlerFacts, type HandlerFact } from "./handler";
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
  /** What the script plays, and what the handler plays (`handler: true`). */
  sounds: { frame: number; id: number; handler?: true }[];
  /** Objects started, with what their blow does (`$3D:9624`). */
  spawns: { frame: number; type: number; anim: number; blow: { type: string; damage: number; stun: number } }[];
  /** What the handler does here: the speed carried in, and the frames it changes. */
  vel: number;
  velAt: [number, number][];
  rearms: number[];
  /**
   * What a handler that runs by step does on the steps of this part — on the
   * condition it tests (landing, turning to fall), which this does not read:
   * the address is in the report.
   */
  onSteps: { step: number; what: string }[];
}

export function portReport(rom: Uint8Array, t: FighterTables, move: number): PortReport {
  const ops = readScript(rom, scriptAt(rom, t, move));
  const boxesOf = (d: number) => readBoxes(rom, t.boxes, d);
  const records = hitRecords(rom, t.character, move);
  const handler = handlerAt(rom, t.character, move);
  const facts = handlerFacts(rom, handler, stepStarts(ops).length);
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
            ? [{ frame: f.frame - from, id: f.sound, handler: true as const }]
            : [],
        ),
      ],
      spawns: events.flatMap((e) =>
        e.op.op === "spawn" && inside(e.frame)
          ? [{ frame: e.frame - from, type: e.op.type, anim: e.op.anim, blow: blowOf(objectRecord(rom, e.op.type, e.op.anim)) }]
          : [],
      ),
      vel: speeds.filter((s) => s.frame < from).at(-1)?.vx ?? 0,
      velAt: speeds.filter((s) => inside(s.frame)).map((s) => [s.frame - from, s.vx]),
      rearms: facts.filter((f) => f.what === "re-arms the blow" && f.frame !== null && inside(f.frame)).map((f) => f.frame! - from),
      onSteps: stepped.filter((f) => inside(stepFrame[f.step])).map((f) => ({ step: f.step, what: describe(f) })),
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
    handler,
    parts,
  };
}

function describe(f: HandlerFact): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  if (f.to !== undefined) return `jumps to move frame ${f.to}`;
  if (f.sound !== undefined) return `plays sound ${hex(f.sound)}`;
  if (f.move !== undefined) return `sets move ${hex(f.move)}`;
  if (f.vx !== undefined) return `sets vx ${f.vx}`;
  return f.what;
}

function blowOf(r: HitRecord): { type: string; damage: number; stun: number } {
  return { type: groundReaction(r), damage: r.damage, stun: r.stun };
}
