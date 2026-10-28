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
  /** Hold a drawing for `frames`; null keeps whichever is up ($EEEE). */
  | { op: "show"; frames: number; drawing: number | null }
  /** Fires once per move (counter field 0x6c): `$0D:D82E` with `id` — the blow ? */
  | { op: "attack"; id: number }
  /** Fires once per move (counter field 0x6d): `$00:DE9F` with `id` — an effect ? */
  | { op: "effect"; id: number }
  /**
   * Where the drawing is drawn, in px from the fighter's position (fields
   * 0x0e / 0x10, added by the sprite routine at $00:818C) — the somersault's
   * ball is drawn 48 px up. x is mirrored when facing left. Lasts until the
   * next offset.
   */
  | { op: "offset"; dx: number; dy: number }
  /** Flips the whole drawing (field 0x14, XORed with the facing) until the next flip. */
  | { op: "flip"; h: boolean; v: boolean }
  /** Hold a drawing until something outside the script moves on ? */
  | { op: "hold"; drawing: number }
  /** Commands whose effect is not read yet, kept whole so nothing is lost. */
  | { op: "raw"; bytes: number[] };

/** Bytes per command, by its first byte; steps (01-7f) are 3. */
const LENGTH: Record<number, number> = { 0xa0: 3, 0xa1: 3, 0xd0: 5, 0xc0: 2, 0xe0: 2, 0xb0: 16, 0xb1: 9, 0x90: 1 };

const KEEP = 0xeeee;

export function readScript(rom: Uint8Array, at: number): ScriptOp[] {
  const ops: ScriptOp[] = [];
  const word = (p: number) => rom[p] | (rom[p + 1] << 8);
  for (let p = at; rom[p] !== 0; ) {
    if (ops.length === 256) throw new Error(`script at 0x${at.toString(16)} has no end`);
    const c = rom[p];
    if (c < 0x80) {
      const drawing = word(p + 1);
      ops.push({ op: "show", frames: c, drawing: drawing === KEEP ? null : drawing });
      p += 3;
    } else if (c >= 0xf0) {
      ops.push({ op: "hold", drawing: word(p + 1) });
      p += 3;
    } else if (c === 0xa0 || c === 0xa1) {
      ops.push({ op: c === 0xa0 ? "attack" : "effect", id: rom[p + 2] });
      p += 3;
    } else if (c === 0xd0) {
      ops.push({ op: "offset", dx: signed16(word(p + 1)), dy: signed16(word(p + 3)) });
      p += 5;
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
