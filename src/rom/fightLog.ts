/**
 * A `record-fight.lua` log read back to what a person looks at first: what
 * each fighter did, in order, and which objects came out. The file is tens of
 * thousands of lines; this is what makes a run cheap to read.
 */

/** A stretch of one move. `to` is the frame it was last seen on. */
export interface MoveRun {
  move: string;
  from: number;
  to: number;
  x: [number, number];
  y: [number, number];
  hp: [number, number];
}

export interface ObjectSeen {
  frame: number;
  slot: number;
  kind: string;
}

const FRAME = /^f(\d+) /;
const FIGHTER = /^\s+(P[12]) (\S+)\s+\d+\s+\d+ \S+ x\s*(-?\d+) y\s*(-?\d+) .* hp=(\d+)/;
const SLOT = /^\s+slot (\d+): (\S\S) (\S\S)/;
/** Bit 7 of an object's first byte says it is alive, and the top bits of the rest its state. */
const TYPE = 0x0f;

export function moveRuns(log: string, who: "P1" | "P2"): MoveRun[] {
  const runs: MoveRun[] = [];
  let frame = 0;
  for (const line of log.split("\n")) {
    const at = FRAME.exec(line);
    if (at) frame = Number(at[1]);
    const m = FIGHTER.exec(line);
    if (!m || m[1] !== who) continue;
    const [x, y, hp] = [Number(m[3]), Number(m[4]), Number(m[5])];
    const last = runs.at(-1);
    if (last?.move === m[2]) {
      last.to = frame;
      [last.x[1], last.y[1], last.hp[1]] = [x, y, hp];
    } else runs.push({ move: m[2], from: frame, to: frame, x: [x, x], y: [y, y], hp: [hp, hp] });
  }
  return runs;
}

/** Each object as it first takes a slot, or as what is in a slot becomes something else. */
export function objectsSeen(log: string): ObjectSeen[] {
  const seen: ObjectSeen[] = [];
  const inSlot = new Map<number, string>();
  let frame = 0;
  for (const line of log.split("\n")) {
    const at = FRAME.exec(line);
    if (at) frame = Number(at[1]);
    const m = SLOT.exec(line);
    if (!m) continue;
    const slot = Number(m[1]);
    const type = parseInt(m[2], 16);
    const kind = type === 0 ? "" : `${(type & TYPE).toString(16).padStart(2, "0")}/${m[3]}`;
    if (kind && kind !== inSlot.get(slot)) seen.push({ frame, slot, kind });
    inSlot.set(slot, kind);
  }
  return seen;
}
