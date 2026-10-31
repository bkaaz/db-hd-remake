/**
 * A move's animation script, as the engine at $01:85FD walks it: steps that
 * show a drawing for some frames, with commands between them. Each frame the
 * engine starts from the top and adds steps up until it passes the frames
 * since the move began (fighter field 0x44), so a step's `frames` is exactly
 * how long its drawing stays up.
 *
 * Command lengths are read from the engine's own handlers; what a command
 * *means* is marked `?` until something confirms it.
 */

export type ScriptOp =
  /**
   * Hold a drawing for `frames`; null keeps whichever is up ($EEEE). After an
   * `opponent` command, `opponent[c]` is the drawing an opponent of character
   * c is shown meanwhile, from his own sheet ($01:86D3).
   */
  | { op: "show"; frames: number; drawing: number | null; opponent?: (number | null)[] }
  /**
   * Fires once per move (counter field 0x6c): queues sound `id` for the APU
   * ($0D:D82E → $00:DE31). Not the blow — what a blow does is looked up at
   * contact from the attacker's move and step (docs/rom.md, Hit data).
   */
  | { op: "sound"; id: number }
  /**
   * Fires once per move (counter field 0x6d): a spoken line, sample `id` of
   * the table at $00:DB98 streamed to the sound chip ($00:DE9F, $00:DB61) —
   * the shout `32` instead when a line is already playing.
   */
  | { op: "voice"; id: number }
  /**
   * Where the drawing is drawn, in px from the fighter's position (fields
   * 0x0e / 0x10, added by the sprite routine at $00:818C) — the somersault's
   * ball is drawn 48 px up. x is mirrored when facing left. Lasts until the
   * next offset.
   */
  | { op: "offset"; dx: number; dy: number }
  /** Flips the whole drawing (field 0x14, XORed with the facing) until the next flip. */
  | { op: "flip"; h: boolean; v: boolean }
  /**
   * Starts an object (handler $01:873F): its type and animation in the object
   * system, where its tiles count from (`tiles`, in tiles — the command's
   * 0x800 words is 0x80), its palette, and where it appears from the fighter's
   * position, x mirrored facing left. Fires only while the move's spawn
   * counter (field 0x6e) equals `counter`, then counts it up — so a handler
   * picks among a script's spawns by setting the counter.
   */
  | { op: "spawn"; counter: number; type: number; anim: number; tiles: number; palette: number; dx: number; dy: number }
  /**
   * Starts an effect that is drawn rather than a sprite ($01:8834): `kind`
   * (2 the charging ball, 1 the Kamehameha's band) at dx / dy from the
   * fighter, x mirrored facing left, of `size`, into the side's block at
   * $30BA / $30CA — `param` × 16 goes to its +0C, not read `?`. Gated by its
   * own counter (field 0x6f) as a spawn is.
   */
  | { op: "effect"; counter: number; kind: number; dx: number; dy: number; size: number; param: number }
  /**
   * Sets fighter field 0x96 to `value` ($01:8732). Bit 6: blows pass him by
   * (`$2A:81C7`, `$2A:8291`); bits 4 and 5 are not read `?`. Kept across a
   * change of move ($01:8518 leaves it).
   */
  | { op: "field96"; value: number }
  /** The script stops here until the move's code moves it on ($01:8689 → RTL). */
  | { op: "stop" }
  /**
   * The opponent's track ($01:8813): one 2-byte pointer per roster character
   * to a script read in step with this one; each later step's `opponent`
   * holds what it shows him.
   */
  | { op: "opponent"; scripts: number[] }
  /** Hold a drawing until something outside the script moves on ? */
  | { op: "hold"; drawing: number }
  /** Commands whose effect is not read yet, kept whole so nothing is lost. */
  | { op: "raw"; bytes: number[] };

/** Bytes per command, by its first byte; steps (01-7f) are 3. */
const LENGTH: Record<number, number> = { 0xa0: 3, 0xa1: 3, 0xd0: 5, 0xc0: 2, 0xe0: 2, 0xb0: 16, 0xb1: 9, 0x90: 1, 0x80: 21 };
/** The opponent's track is read this many bytes behind the script's own position ($01:86D9). */
const TRACK_LAG = 0x15;
const ROSTER_SIZE = 10;
const SPAWN_LENGTH = 16;

const KEEP = 0xeeee;

export function readScript(rom: Uint8Array, at: number): ScriptOp[] {
  const ops: ScriptOp[] = [];
  const word = (p: number) => rom[p] | (rom[p + 1] << 8);
  // the opponent's scripts, as file offsets, once an `opponent` command is read
  let track: number[] | null = null;
  const opponentAt = (p: number) =>
    track?.map((sub) => {
      const w = word(sub + (p + 1 - at) - TRACK_LAG);
      return w === KEEP ? null : w;
    });
  for (let p = at; rom[p] !== 0; ) {
    if (ops.length === 256) throw new Error(`script at 0x${at.toString(16)} has no end`);
    const c = rom[p];
    if (c < 0x80) {
      const drawing = word(p + 1);
      const opponent = opponentAt(p);
      ops.push({ op: "show", frames: c, drawing: drawing === KEEP ? null : drawing, ...(opponent && { opponent }) });
      p += 3;
    } else if (c === 0x80) {
      // the pointers are 2-byte, in the script's own bank
      const bankBase = at - (at % 0x8000);
      track = Array.from({ length: ROSTER_SIZE }, (_, i) => bankBase + (word(p + 1 + 2 * i) - 0x8000));
      ops.push({ op: "opponent", scripts: track });
      p += LENGTH[c];
    } else if (c === 0x90) {
      ops.push({ op: "stop" });
      p += 1;
    } else if (c === 0xc0) {
      ops.push({ op: "field96", value: rom[p + 1] });
      p += 2;
    } else if (c === 0xb1) {
      ops.push({
        op: "effect",
        counter: rom[p + 1],
        kind: rom[p + 2],
        dx: signed16(word(p + 3)),
        dy: signed16(word(p + 5)),
        size: rom[p + 7],
        param: rom[p + 8],
      });
      p += 9;
    } else if (c >= 0xf0) {
      ops.push({ op: "hold", drawing: word(p + 1) });
      p += 3;
    } else if (c === 0xa0 || c === 0xa1) {
      ops.push({ op: c === 0xa0 ? "sound" : "voice", id: rom[p + 2] });
      p += 3;
    } else if (c === 0xd0) {
      ops.push({ op: "offset", dx: signed16(word(p + 1)), dy: signed16(word(p + 3)) });
      p += 5;
    } else if (c === 0xb0) {
      const base = word(p + 4);
      ops.push({
        op: "spawn",
        counter: rom[p + 1],
        type: rom[p + 2] & 0x0f,
        anim: rom[p + 3],
        // bit 15 marks a base the engine shifts for player two
        tiles: (base & 0x7fff) >> 4,
        palette: (rom[p + 6] >> 1) & 7,
        dx: signed16(word(p + 7)),
        dy: signed16(word(p + 9)),
      });
      p += SPAWN_LENGTH;
    } else if (c === 0xe0 && !(rom[p + 1] & 0x3f)) {
      ops.push({ op: "flip", h: (rom[p + 1] & 0x40) !== 0, v: (rom[p + 1] & 0x80) !== 0 });
      p += 2;
    } else if (LENGTH[c]) {
      ops.push({ op: "raw", bytes: [...rom.subarray(p, p + LENGTH[c])] });
      p += LENGTH[c];
    } else {
      throw new Error(`script at 0x${at.toString(16)}: command 0x${c.toString(16)} at 0x${p.toString(16)} is not read yet`);
    }
  }
  return ops;
}

function signed16(v: number): number {
  return v < 0x8000 ? v : v - 0x10000;
}
