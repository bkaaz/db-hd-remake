/**
 * A recording of the object slots (`tools/re/record-objects.lua`, ADR 0036)
 * read back as the lives of objects: each time a slot holds one type and
 * animation, which frames it showed for how long, where it started, how
 * fast it went, and what the slot held straight after — the explosion a
 * shot becomes. A frame in which the hitstop ran and the slot did not
 * change is not counted: the object stood still, as most do ($30B2).
 */

export interface Life {
  slot: number;
  type: number;
  anim: number;
  /** The recording's frame it appeared on, and the first one it was gone. */
  from: number;
  to: number;
  /** The frames it showed, each with the frames it was shown for. */
  steps: { frame: number; dur: number }[];
  x: number;
  y: number;
  /** px per frame, 8.8 read as written: x as the object faced. */
  vx: number;
  vy: number;
  /** What the slot held from the frame this one was gone, if anything. */
  then?: { type: number; anim: number };
  /** A hitstop began within a frame of its end: it hit something. */
  hit: boolean;
}

interface Frame {
  frame: number;
  hit: number;
  slots: (number[] | null)[];
}

const SLOTS = 10;
const ALIVE = 0x80;
/** Byte 0's type is its low nibble, as `$0D:EBE0` reads it (`AND #$FF0F`); bits 4–6 are something else. */
const TYPE = 0x0f;

/** Every frame the recording covers, each with every slot as it stood. */
export function readFrames(text: string): Frame[] {
  const out: Frame[] = [];
  let slots: (number[] | null)[] = Array(SLOTS).fill(null);
  let hit = 0;
  let at: number | null = null;
  const flush = (upTo: number) => {
    if (at === null) return;
    for (let f = at; f < upTo; f++) out.push({ frame: f, hit, slots });
  };
  for (const line of text.split("\n")) {
    // `hit=` from record-objects.lua; log-objects.lua's older lines have none
    const head = /^f(\d+) (?:.*hit=([0-9a-f]+))?/.exec(line);
    const slot = /^ {2}slot (\d+): ([0-9a-f ]+)$/.exec(line);
    if (head) {
      flush(Number(head[1]));
      at = Number(head[1]);
      hit = head[2] ? parseInt(head[2], 16) : 0;
      slots = [...slots];
    } else if (slot) {
      slots[Number(slot[1])] = slot[2].trim().split(" ").map((b) => parseInt(b, 16));
    }
  }
  flush((at ?? 0) + 1);
  return out;
}

export function readLives(text: string): Life[] {
  const frames = readFrames(text);
  const lives: Life[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    let life: Life | null = null;
    let before: number[] | null = null;
    for (const { frame, hit, slots } of frames) {
      const b = slots[slot];
      const alive = !!b && (b[0] & ALIVE) !== 0;
      const same = alive && life && (b![0] & TYPE) === life.type && b![1] === life.anim;
      if (life && !same) {
        life.to = frame;
        if (alive) life.then = { type: b![0] & TYPE, anim: b![1] };
        lives.push(life);
        life = null;
      }
      if (alive && !life) life = start(slot, frame, b!);
      if (life && b) {
        const frozen = hit !== 0 && before !== null && b.every((v, i) => v === before![i]);
        const last = life.steps.at(-1);
        if (!frozen) {
          if (last && last.frame === b[2]) last.dur++;
          else life.steps.push({ frame: b[2], dur: 1 });
        }
      }
      before = b;
    }
    if (life) lives.push({ ...life, to: frames.at(-1)!.frame + 1 });
  }
  // it hit something when a hitstop began about as it went
  for (const life of lives) {
    life.hit = frames.some((f) => f.hit !== 0 && Math.abs(f.frame - life.to) <= 1);
  }
  return lives.sort((a, b) => a.from - b.from || a.slot - b.slot);
}

/**
 * The life that shows an object whole: the longest one that hit nothing,
 * since a hit cuts a life short; the longest of all if every one hit.
 */
export function fullestLife(lives: Life[], type: number, anim: number): Life | undefined {
  const all = lives.filter((l) => l.type === type && l.anim === anim).sort((a, b) => b.to - b.from - (a.to - a.from));
  return all.find((l) => !l.hit) ?? all[0];
}

function start(slot: number, frame: number, b: number[]): Life {
  const word = (i: number) => b[i] | (b[i + 1] << 8);
  const signed = (n: number) => ((n << 16) >> 16) / 256;
  return {
    slot, type: b[0] & TYPE, anim: b[1], from: frame, to: frame, steps: [],
    x: word(6), y: word(9), vx: signed(word(0x0c)), vy: signed(word(0x0e)), hit: false,
  };
}

/** One snapshot of `objects-rec.bin`: the first time an object frame was on screen. */
export interface Snapshot {
  frame: number;
  slot: number;
  /** The slot's 16 bytes. */
  bytes: Uint8Array;
  vram: Uint8Array;
  cgram: Uint8Array;
  oam: Uint8Array;
}

const VRAM = 0x10000;
const CGRAM = 0x200;
const OAM = 0x220;

export function readSnapshots(bin: Uint8Array): Snapshot[] {
  const size = 4 + 1 + 16 + VRAM + CGRAM + OAM;
  const out: Snapshot[] = [];
  for (let at = 0; at + size <= bin.length; at += size) {
    const frame = bin[at] | (bin[at + 1] << 8) | (bin[at + 2] << 16) | (bin[at + 3] << 24);
    let p = at + 5;
    const take = (n: number) => bin.subarray(p, (p += n));
    out.push({ frame, slot: bin[at + 4], bytes: take(16), vram: take(VRAM), cgram: take(CGRAM), oam: take(OAM) });
  }
  return out;
}

