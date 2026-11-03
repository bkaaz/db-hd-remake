/**
 * A WAV of the original's sound test cut by the frames its script logged
 * (`tools/re/record-sound-test.lua`), so a file is named by what the game
 * asked for — never by where the silences fell, nor by likeness.
 * The WAV and the log are started by hand, apart, so the one thing worked
 * out is how far the WAV runs ahead: the frames the log says a voice sounded
 * are slid along the WAV's loud frames until they agree. Pure.
 */

/** NTSC: the SNES's frames a second, which the log counts in. */
export const SNES_FPS = 21477272 / 4 / (341 * 262 - 0.5);

/**
 * One entry played: the frame A went down, the first silent frame after, and
 * the effect id the game asked for — null for a sample streamed from the
 * cartridge (a voice, a line), whose bytes go through the same port by the
 * hundred a frame.
 */
export interface Press {
  a: number;
  quiet: number;
  asked: number | null;
}

const MARK = /^# (a|quiet) f(\d+)/;
const REQUEST = /^f(\d+) sound ([0-9a-f]+)/;
const VOICE = /^f(\d+) v\d/;

/** The presses of a log, in order; an A with no quiet after it (stopped early) is dropped. */
export function presses(log: string): Press[] {
  const lines = log.split("\n");
  const perFrame = new Map<number, number>();
  for (const line of lines) {
    const m = REQUEST.exec(line);
    if (m) perFrame.set(Number(m[1]), (perFrame.get(Number(m[1])) ?? 0) + 1);
  }
  const out: Press[] = [];
  let open: { a: number; asked: number | null; heard: boolean } | null = null;
  for (const line of lines) {
    const r = REQUEST.exec(line);
    if (r && open && !open.heard) {
      open.heard = true;
      if (perFrame.get(Number(r[1])) === 1) open.asked = parseInt(r[2], 16);
    }
    const m = MARK.exec(line);
    if (!m) continue;
    if (m[1] === "a") open = { a: Number(m[2]), asked: null, heard: false };
    else if (open) {
      out.push({ a: open.a, quiet: Number(m[2]), asked: open.asked });
      open = null;
    }
  }
  return out;
}

/**
 * The file name of each entry of the sound test's list, which runs: every
 * effect once, by its id (`05`); each fighter's three voices — the blow
 * taken (`30`), the KO (`31`), the shout (`32`) — in `fighters`' order
 * (`goku_31`); every spoken line (`line_0d`). It wraps to its first entry
 * after the last, and the names stop there.
 */
export function catalogue(asked: (number | null)[], fighters: readonly string[]): string[] {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const names: string[] = [];
  let streamed = 0;
  for (const [i, id] of asked.entries()) {
    if (i > 0 && id !== null && id === asked[0]) break;
    if (id !== null) names.push(hex(id));
    else {
      const voice = streamed < 3 * fighters.length;
      names.push(voice ? `${fighters[Math.floor(streamed / 3)]}_${hex(0x30 + (streamed % 3))}` : `line_${hex(streamed - 3 * fighters.length)}`);
      streamed++;
    }
  }
  return names;
}

/** Per frame of the log, 1 where some voice sounded. */
export function sounding(log: string): Uint8Array {
  const frames: number[] = [];
  for (const line of log.split("\n")) {
    const m = VOICE.exec(line);
    if (m) frames.push(Number(m[1]));
  }
  const out = new Uint8Array(Math.max(0, ...frames) + 1);
  for (const f of frames) out[f] = 1;
  return out;
}

/** Per SNES frame of the WAV, 1 where it is louder than `floor` (RMS). */
export function loud(samples: Float32Array, perFrame: number, floor = 0.004): Uint8Array {
  const n = Math.floor(samples.length / perFrame);
  const out = new Uint8Array(n);
  for (let f = 0; f < n; f++) {
    const from = Math.round(f * perFrame);
    const to = Math.round((f + 1) * perFrame);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    out[f] = Math.sqrt(sum / (to - from)) > floor ? 1 : 0;
  }
  return out;
}

/**
 * How many frames the WAV runs ahead of the log: the slide at which the
 * log's sounding frames and the WAV's loud ones agree most (both as ±1, so
 * silence agreeing counts as much as sound). Searched from `min` to `max`,
 * over the log's frames `from` to `to` — the whole log first, then each
 * press again, since Mesen's WAV drifts against the frames by a few.
 */
export function lag(log: Uint8Array, wav: Uint8Array, min: number, max: number, from = 0, to = log.length): number {
  let best = min;
  let bestScore = -Infinity;
  for (let by = min; by <= max; by++) {
    let score = 0;
    for (let f = Math.max(0, from); f < Math.min(log.length, to); f++) {
      const w = f + by;
      if (w < 0 || w >= wav.length) continue;
      score += log[f] === wav[w] ? 1 : -1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = by;
    }
  }
  return best;
}

/**
 * The WAV's frames that hold press `i`: from a little before A to a little
 * after the quiet (the echo rings on past the last voice), never reaching the
 * cursor's sound — the script presses → `QUIET` frames after the quiet — then
 * shrunk to the frames that are loud. Null when none are: a number that
 * plays nothing.
 */
export function span(press: Pick<Press, "a" | "quiet">, by: number, wav: Uint8Array, before = 12, after = 24): { from: number; to: number } | null {
  let from = Math.max(0, press.a + by - before);
  let to = Math.min(wav.length, press.quiet + by + after);
  while (from < to && !wav[from]) from++;
  while (to > from && !wav[to - 1]) to--;
  return from < to ? { from, to } : null;
}
